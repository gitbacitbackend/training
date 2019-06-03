/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
//https://us-central1-mmfapp-3603c.cloudfunctions.net/
// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const moment = require("moment");
const Spotify = require("node-spotify-api");

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

var db = admin.firestore();

const runtimeOpts = {
  timeoutSeconds: 300,
  memory: "1GB"
};
const BEGINTIME = "T00:00:00";
const ENDTIME = "T23:59:59";

// Function for registering mood, insert data into mood collection
exports.registerMood = functions.https.onRequest((req, res) => {
  // Get body from post with data for mood
  var getData = req.body.data;
  console.log(getData.data);
  let time = timestampHandler(getData.timestamp);
  getData.timestamp = time.timestamp;
  getData.week = time.week;
  getData.weekday = time.weekday;
  cors(req, res, () => {
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    // calls verifytoken with the idToken from Header
    const verifyer = verifyToken(idToken);

    verifyer.then(verify => {
      if (verify.authenticated === true) {
        const getUser = verify.userid;
        getData.userID = getUser;
        if (getUser === undefined) {
          return res.status(401).json({
            error: "User is undefined"
          });
        } else {
          if (req.method !== "POST") {
            return res.status(405).json({
              message: "Only POST allowed"
            });
          } else {
            let collection = "Mood";
            // eslint-disable-next-line promise/no-nesting
            let register = db
              .collection(collection)
              .add(getData)
              .then(ref => {
                console.log("Added document with ID: ", ref.id);
                return res.status(200).json({
                  toCollection: collection,
                  registeredData: getData
                });
              });
          }
        }
      }
    });
  });
});

// [START basic_wildcard]
// Listen for creation of documents in the 'mood' collection
// Initiate spotify call from here
exports.registerData = functions.firestore
  .document("Mood/{userID}")
  .onCreate((snap, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    let newValue = snap.data();
    console.log(newValue);

    // access a particular field as you would any JS property
    let userID = newValue.userID;
    let mood = newValue.mood;

    // String for song ID's built by function
    let songs = "";

    // Array for song objects that should be deleted after queries are complete
    let deleteSongs = [];
    // Array for fitbit objects that should be deleted after queries are complete
    var deleteFitbit = [];

    /* Spotify identifyer information and new object to use for calls
    * TODO: Needs to be updated to correct ID and SECRET, temporary user authentication,
    * Visit developer.spotify.com
    */
    var spotify = new Spotify({
      id: "462be484f8f245d896aa9ebb64ffa482",
      secret: "b6b6d1b122ed4f2b8ae0ea1c1a826c1f"
    });

    /* Function for API call to spotify for getting audio features from track
    @param {string} id - id of song to be queried for
    @return/resolve Array of result as promise
    */
    function getAudioFeatures(id) {
      return new Promise((resolve, reject) => {
        console.log("Started audio features analysis with ", id);
        spotify
          .request("https://api.spotify.com/v1/audio-features?ids=" + id)
          .then(data => {
            let songObj = {};
            Object.assign(songObj, data.audio_features);
            resolve(songObj);
            return songObj;
          })
          .catch(err => {
            console.error("Error occurred: " + err);
            reject(err);
            return err;
          });
      });
    }

    /* Function for gettings songs form temp music collection. And build song ID string for query to spotify
    @return/resolve array of result data as promise
    */
    function getSongs() {
      return new Promise((resolve, reject) => {
        var spotres = [];

        let getStoredMusic = db
          .collection("TempMusic")
          .where("userID", "==", userID)
          .orderBy("timestamp");
        getStoredMusic
          .get()
          .then(querySnapshot => {
            querySnapshot.forEach(doc => {
              deleteSongs.push(doc.id);

              if (songs === "") {
                songs += doc.get("id");
              } else {
                songs += "," + doc.get("id");
              }
              spotres.push(doc.data());

              return doc.data();
            });
          })
          .then(() => {
            resolve(spotres);
          })
          .catch(err => {
            console.log("Error getting document from music", err);
            reject(err);
            return err;
          });
      });
    }
    /*Function for getting the fitbit objects from temp fitbit collection
    @return/resolve array of fitbit objects as promise
     */
    function getFitbit() {
      var fitRes = [];
      return new Promise((resolve, reject) => {
        let getFitbit = db
          .collection("TempFitBit")
          .where("userID", "==", userID);
        getFitbit
          .get()
          .then(querySnapshot => {
            querySnapshot.forEach(doc => {
              deleteFitbit.push(doc.id);
              fitRes.push(doc.data());
            });
          })
          .then(() => {
            resolve(fitRes);
          })
          .catch(err => {
            console.log("Error getting document from fitbit", err);
            reject(err);
            return err;
          });
      });
    }

    // Run fitbit functions and set object for adding to database
    Promise.all([getFitbit()]).then(res => {
      res = res[0];
      for (item in res) {
        let dataObj = {};
        let fitObj = res[item];

        dataObj.calories = fitObj.caloriesout;
        dataObj.timestamp = fitObj.timestamp;
        dataObj.week = fitObj.week;
        dataObj.weekday = fitObj.weekday;
        dataObj.year = fitObj.year;
        dataObj.steps = fitObj.steps;
        dataObj.goals = fitObj.goals;
        dataObj.userID = fitObj.userID;
        dataObj.mood = mood;
        let docID =
          fitObj.year.toString() +
          fitObj.week.toString() +
          fitObj.weekday.toString() +
          fitObj.userID;
        console.log(dataObj);
        // eslint-disable-next-line promise/no-nesting
        db.collection("Fitbit")
          .doc(docID)
          .create(dataObj)
          // eslint-disable-next-line no-loop-func
          .then(() => {
            console.log("Fitbit Document updated or written with ID: ", docID);
          })
          // eslint-disable-next-line no-loop-func
          .catch(error => {
            console.log("Error adding document: ", error);
          });
      }
      //DELETE fitbit objects in temp collection for user
      for (item in deleteFitbit) {
        db.collection("TempFitBit")
          .doc(deleteFitbit[item])
          .delete();
      }
    });

    // Promise resolving getSongs then handle the data from both getters. Resolve on adding merged item to database.
    Promise.all([getSongs()]).then(res => {
      // eslint-disable-next-line promise/no-nesting
      getAudioFeatures(songs).then(audioFeatures => {
        let tracks = res[0];
        for (item = 0; item < 3; item++) {
          let songObj = {};
          songObj["energy"] = audioFeatures[item].energy;
          songObj["danceability"] = audioFeatures[item].danceability;
          songObj["valence"] = audioFeatures[item].valence;
          let artists = tracks[item].artists;
          let artistFull = "";
          for (artist in artists) {
            if (artistFull === "") {
              artistFull += artists[artist].name;
            } else {
              artistFull += ", " + artists[artist].name;
            }
          }
          songObj.artist = artistFull;
          songObj.title = tracks[item].name;
          songObj.timestamp = tracks[item].timestamp;
          songObj.userID = tracks[item].userID;
          songObj.id = tracks[item].id;
          songObj.week = tracks[item].week;
          songObj.weekday = tracks[item].weekday;
          songObj.year = tracks[item].year;
          songObj.mood = mood;
          console.log(songObj);
          // eslint-disable-next-line promise/no-nesting
          db.collection("Music")
            .add(songObj)
            // eslint-disable-next-line no-loop-func
            .then(docRef => {
              console.log("Spotify Document written with ID: ", docRef.id);
            })
            // eslint-disable-next-line no-loop-func
            .catch(error => {
              console.error("Error adding document: ", error);
              return error;
            });
        }
        //DELETE song objects in temp collection for user
        for (item in deleteSongs) {
          db.collection("TempMusic")
            .doc(deleteSongs[item])
            .delete();
        }
      });
    });
  });

/*Function for adding timestamp to input without timestamp
@param {string/number} timestamp - timestamp in format "YYYY-MM-DD" / alternative full format: "YYYY-MM-DDTHH:MM:SS" where SS is optional
@param {string} type - the type of request, set by the calling function, optional param
return date timestamp for use in firestore timestamp class
*/
function timestampHandler(timestamp, type) {
  let time = "";
  if (type === "BEGINTIME") {
    time = "T00:00:00";
  } else if (type === "ENDTIME") {
    time = "T23:59:59";
  } else if (type === "SPOTIFY") {
    time = "T22:22:22";
  }

  /* Checks if timestamp is not undefined and length is under 10
    This to verify it is not complete unix ms timestamp or in format of YYYY-MM-DDTHH:MM
  */
  if (timestamp !== undefined && timestamp.toString().length <= 10) {
    // If time is set, it will be added for START or END times * Used for day queries
    if (time !== "") {
      let fullTime = {};
      fullTime["timestamp"] = firedate = admin.firestore.Timestamp.fromDate(
        new Date(timestamp + time)
      );
      fullTime["weekday"] = weekday = moment(firedate.toDate()).isoWeekday();
      fullTime["week"] = week = moment(firedate.toDate()).isoWeek();
      fullTime["year"] = week = moment(firedate.toDate()).year();
      return fullTime;
    } else {
      let fullTime = {};
      fullTime["timestamp"] = firedate = admin.firestore.Timestamp.fromDate(
        new Date(timestamp * 1000)
      );
      fullTime["weekday"] = weekday = moment(firedate.toDate()).isoWeekday();
      fullTime["week"] = week = moment(firedate.toDate()).isoWeek();
      fullTime["year"] = week = moment(firedate.toDate()).year();
      return fullTime;
    }
  } else {
    // Sets new timestamp from full unix timestamp or full date format of: YYYY-MM-DDTHH:MM
    let fullTime = {};
    if (typeof timestamp === "number") {
      fullTime["timestamp"] = firedate = admin.firestore.Timestamp.fromMillis(
        timestamp
      );
    } else {
      fullTime["timestamp"] = firedate = admin.firestore.Timestamp.fromDate(
        new Date(timestamp)
      );
    }
    fullTime["weekday"] = weekday = moment(firedate.toDate()).isoWeekday();
    fullTime["week"] = week = moment(firedate.toDate()).isoWeek();
    fullTime["year"] = week = moment(firedate.toDate()).year();

    return fullTime;
  }
}

// Get mood for one day from timestamp of user
exports.getDailyMood = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let query = db.collection("Mood");
    let timeStamp = req.query.timestamp;

    let unixStart = timestampHandler(timeStamp, "BEGINTIME");
    let unixEnd = timestampHandler(timeStamp, "ENDTIME");
    const idToken = req.headers["authorization"].split("Bearer ")[1];


    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {
      console.log("Promise result ", verifyer);

      if (verify.authenticated === true) {
        const getUser = verify.userid;

        if (timeStamp !== undefined) {
          let result = [];
          // eslint-disable-next-line promise/no-nesting
          let users = query
            .where("userID", "==", getUser)
            .where("timestamp", ">", unixStart.timestamp)
            .where("timestamp", "<", unixEnd.timestamp)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                return res.status(404).json({
                  error: "No matching documents"
                });
              }
              snapshot.forEach(doc => {
                result.push(doc.data());
              });
              return res.status(200).json({
                Mood: result
              });
            })
            .catch(err => {
              let errmsg = "error getting docs," + err;
              return res.status(500).json({
                error2: errmsg
              });
            });
        }
      }
    });
  });
});

// Manual deletion of collections *Used for testing and purging of collections
exports.deleteCollection = functions.https.onRequest((req, res) => {
  let deletions = [];
  let incomming = 0;
  let deleted = 0;
  db.collection(req.query.collection)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        deletions.push(doc.id);
        incomming++;
      });
    })
    .then(() => {
      for (doc in deletions) {
        db.collection(req.query.collection)
          .doc(deletions[doc])
          .delete();
        deleted++;
      }
    })
    .then(() => {
      return res.status(200).json({
        Deleted: deleted,
        Incomming: incomming
      });
    })
    .catch(err => {
      console.log("Error getting documents", err);
    });
});

// Function for adding DigiMe data from client side to a temporary collection
exports.tempDigiMe = functions.https.onRequest((req, res) => {

  // obj [body] is actual filedata recieved from digi.me in form of JSON string objects
  let obj = req.body.data;
  const idToken = req.headers["authorization"].split("Bearer ")[1];
  const verifyer = verifyToken(idToken);
  verifyer.then(verify => {
    console.log("Promise result ", verifyer);

    if (verify.authenticated === true) {
      const getUser = verify.userid;

      var DigiObj = {};
      for (entry in obj) {
        console.log(JSON.parse(obj[entry]));
        Object.assign(DigiObj, JSON.parse(obj[entry]));
      }
      cors(req, res, () => {
        let promises = [];
        let fitPromises = [];
        if (req.method !== "POST") {
          return res.status(405).json({
            message: "Only POST allowed"
          });
        } else {
          for (key in DigiObj) {
            if (key === "spotify") {
              var resObj = {};
              var spotifyObj = DigiObj.spotify;
              for (items in spotifyObj) {
                let oneSong = spotifyObj[items];
                let trackObj = spotifyObj[items].track;
                let dataObj = {};
                const getTime = spotifyObj[items].createddate;
                let time = timestampHandler(getTime);
                dataObj["userID"] = getUser;
                dataObj["timestamp"] = time.timestamp;
                dataObj["week"] = time.week;
                dataObj["weekday"] = time.weekday;
                dataObj["year"] = time.year;
                Object.assign(dataObj, trackObj);
                let collection = "TempMusic";
                // eslint-disable-next-line no-loop-func
                var register = new Promise(resolve => {
                  promises.push(register);
                  // eslint-disable-next-line promise/no-nesting
                  db.collection(collection)
                    .add(dataObj)
                    // eslint-disable-next-line no-loop-func
                    .then(ref => {
                      console.log("Added document with ID: ", ref.id);
                      Object.assign(resObj, dataObj);
                      resolve();
                    });
                });
              }
            } else if (key === "fitbit") {
              var fitbitObj = DigiObj.fitbit;
              for (items in fitbitObj) {
                // console.log(fitbitObj[items]);
                fitbitObj[items].userID = getUser;
                if (fitbitObj[items].caloriesout) {
                  let collection = "TempFitBit";
                  let getTime = fitbitObj[items].createddate;
                  let time = timestampHandler(getTime);
                  fitbitObj[items]["userID"] = getUser;
                  fitbitObj[items]["timestamp"] = time.timestamp;
                  fitbitObj[items]["week"] = time.week;
                  fitbitObj[items]["weekday"] = time.weekday;
                  fitbitObj[items]["year"] = time.year;
                  // eslint-disable-next-line no-loop-func
                  var registerFit = new Promise(resolve => {
                    fitPromises.push(registerFit);
                    // eslint-disable-next-line promise/no-nesting
                    db.collection(collection)
                      .add(fitbitObj[items])
                      // eslint-disable-next-line no-loop-func
                      .then(ref => {
                        console.log("Added document with ID: ", ref.id);
                        resolve();
                      });
                  });
                }
              }
            }
          }

          // eslint-disable-next-line promise/no-nesting
          Promise.all(fitPromises, promises).then(() => {
            return res.status(200).json({
              DataAdded: "ok"
            });
          });
        }
      });
    }
  });
});

// Get activity for one user
exports.getFitbit = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    const getWeek = parseInt(req.query.weekID);
    const query = db.collection("Fitbit");


    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {

      if (verify.authenticated === true) {
        const getUser = verify.userid;
        let result = [];
        // eslint-disable-next-line promise/no-nesting
        let users = query
          .where("userID", "==", getUser)
          .where("week", "==", getWeek)
          .get()
          .then(snapshot => {
            snapshot.forEach(doc => {
              result.push(doc.data());
            });
            if (snapshot.empty) {
              return res.status(418).json({
                error: "No matching documents."
              });
            }
            return res.status(200).json({
              Fitbit: result
            });
          })
          .catch(err => {
            let errmsg = "Error getting documents" + err;
            return (res.status(500).json = {
              error: errmsg
            });
          });
      }
    });
  });
});

//Manual search for users which provides userRecord and info: getUserInfo?id=STRING
exports.getUserInfo = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let uid = req.query.id;
    admin
      .auth()
      .getUser(uid)
      .then(userRecord => {
        // See the UserRecord reference doc for the contents of userRecord.
        console.log("Successfully fetched user data:", userRecord.toJSON());
        return res.status(200).json({
          user: userRecord
        });
      })
      .catch(error => {
        console.log("Error fetching user data:", error);
      });
  });
});

// Function for getting music data for one week.
// TODO: Endre navn, og oppdater i frontend
exports.getMusicWeek = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const query = db.collection("Music");
    const getWeekID = parseInt(req.query.week);
    const idToken = req.headers["authorization"].split("Bearer ")[1];

    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {

      if (verify.authenticated === true) {
        const getUser = verify.userid;
        if (getUser === undefined) {
          return res.status(401).json({
            error: "User is undefined"
          });
        } else if (getWeekID !== undefined) {
          let valence = [];
          let energy = [];
          let danceability = [];
          let mood = [];
          let fulldata = [];
          let date = [];
          let checker = [];

          // eslint-disable-next-line promise/no-nesting
          let music = query
            .where("week", "==", getWeekID)
            .where("userID", "==", getUser)
            .orderBy("weekday", "desc")
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                return res.status(404).json({
                  error: "No document for this weekID"
                });
              }
              snapshot.forEach(doc => {
                day = doc.get("weekday");
                unixTime = new Date(doc.get("timestamp")._seconds * 1000);

                year = unixTime.getFullYear();
                month = unixTime.getMonth() + 1;
                day = unixTime.getDate();

                valence.push(doc.get("weekday") + ":" + doc.get("valence"));
                energy.push(doc.get("weekday") + ":" + doc.get("energy"));
                danceability.push(
                  doc.get("weekday") + ":" + doc.get("danceability")
                );
                date.push(
                  doc.get("weekday") + ":" + year + "-" + month + "-" + day
                );
                mood.push(doc.get("weekday") + ":" + doc.get("mood"));

                // Checks wether the doc/day is not already in array
                if (!checker.includes(doc.get("weekday"))) {
                  checker.push(doc.get("weekday"));
                }
              });

              while (checker.length) {
                var valenceSum = 0;
                var energySum = 0;
                var danceabilitySum = 0;
                var valenceAntall = 0;
                var energyAntall = 0;
                var danceabilityAntall = 0;
                var tempdate = "";

                // gets next item/day in checker for processing
                let popDay = checker.pop();
                tempmood = [];

                // eslint-disable-next-line no-loop-func
                //Iterates over all items. Splits the strings items/days for processing.
                mood.forEach(item => {
                  if (parseInt(item.split(":")[0]) === popDay) {
                    m = item.split(":")[1];
                    tempmood.push(m);
                  }
                });

                // eslint-disable-next-line no-loop-func
                date.forEach(item => {
                  if (parseInt(item.split(":")[0]) === popDay) {
                    d = item.split(":")[1];
                    tempdate = String(d);
                  }
                });

                // eslint-disable-next-line no-loop-func
                // Sums the values for each day
                valence.forEach(item => {
                  if (parseInt(item.split(":")[0]) === popDay) {
                    valenceSum = valenceSum + parseFloat(item.split(":")[1]);
                    valenceAntall++;
                  }
                });

                valenceSum = valenceSum / valenceAntall;
                var resultValence = valenceSum.toFixed(2) * 100;

                // eslint-disable-next-line no-loop-func
                energy.forEach(item => {
                  if (parseInt(item.split(":")[0]) === popDay) {
                    energySum = energySum + parseFloat(item.split(":")[1]);
                    energyAntall++;
                  }
                });
                energySum = energySum / energyAntall;
                var resultEnergy = energySum.toFixed(2) * 100;

                // eslint-disable-next-line no-loop-func
                danceability.forEach(item => {
                  if (parseInt(item.split(":")[0]) === popDay) {
                    danceabilitySum =
                      danceabilitySum + parseFloat(item.split(":")[1]);
                    danceabilityAntall++;
                  }
                });
                danceabilitySum = danceabilitySum / danceabilityAntall;
                var resultDanceability = danceabilitySum.toFixed(2) * 100;

                fulldata.push({
                  Energy: resultEnergy,
                  Danceability: resultDanceability,
                  Valence: resultValence,
                  weekday: popDay,
                  date: tempdate,
                  mood: tempmood
                });
              }
              var obj = JSON.parse(JSON.stringify(fulldata));

              return res.status(200).json({
                MusicStats: obj
              });
            })
            .catch(err => {
              let errmsg = "Error getting documents" + err;
              return res.status(500).json({
                error: errmsg
              });
            });
        }
      }
    });
  });
});

//Used for developing the token auth
exports.getProfile = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // idToken comes from the client app

    const query = db.collection("Profile");
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    console.log(idToken);

    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {
      console.log("Promise result ", verifyer);

      if (verify.authenticated === true) {
        const getUser = verify.userid;

        if (getUser !== undefined) {
          let result = [];
          // eslint-disable-next-line promise/no-nesting
          let users = query
            .where("userID", "==", getUser)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                return res.status(404).json({
                  error: "No matching documents."
                });
              }
              snapshot.forEach(doc => {
                console.log(doc.id, "=>", doc.data());
                result.push(doc.data());
              });
              return res.status(200).json({
                Profile: result
              });
            })
            .catch(err => {
              let errmsg = "Error getting documents" + err;
              return (res.status(500).json = {
                error: errmsg
              });
            });
        }
      }
    });
  });
});

// Function for verifying token with Firebase authentication
function verifyToken(idToken) {
  return new Promise(resolve => {
    admin
      .auth()
      .verifyIdToken(idToken)
      .then(decodedToken => {
        var uid = decodedToken.uid;
        console.log("uid er: " + uid);
        resolve({ authenticated: true, userid: uid });
      })
      .catch(error => {
        console.log("Error authenticating user", error);
        resolve({ authenticated: false, userid: "" });
      });
  });
}

// Gets all the music for data presentation in musictables
exports.getAllMusic = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const query = db.collection("Music");
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    console.log(idToken);

    const getTime = req.query.timestamp;

    let unixStart = timestampHandler(getTime, "BEGINTIME");
    let unixEnd = timestampHandler(getTime, "ENDTIME");

    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {
      console.log("Promise result ", verifyer);

      if (verify.authenticated === true) {
        const getUser = verify.userid;

        if (getTime === undefined) {
          return res.status(400).json({
            error: "Error setting time"
          });
        }
        // Get music from specific moods by user. Builds and returns objects
        else {
          let result = [];
          let happy = [];
          let sad = [];
          let neutral = [];
          // eslint-disable-next-line promise/no-nesting
          let users = query
            .where("userID", "==", getUser)
            .where("timestamp", ">", unixStart.timestamp)
            .where("timestamp", "<", unixEnd.timestamp)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                return res.status(404).json({
                  error: "No matching documents."
                });
              }
              snapshot.forEach(doc => {
                if (doc.get("mood").toLowerCase() === "happy") {
                  happy.push(doc.data());
                } else if (doc.get("mood").toLowerCase() === "excellent") {
                  happy.push(doc.data());
                } else if (doc.get("mood").toLowerCase() === "sad") {
                  sad.push(doc.data());
                } else if (doc.get("mood").toLowerCase() === "terrible") {
                  sad.push(doc.data());
                } else {
                  neutral.push(doc.data());
                }
              });
              result = {
                happy: happy,
                sad: sad,
                neutral: neutral
              };
              return res.status(200).json({
                Mood: result
              });
            })
            .catch(err => {
              let errmsg = "error getting docs," + err;
              return res.status(500).json({
                error2: errmsg
              });
            });
        }
      }
    });
  });
});

//Gathers all the data for the frontpage, combining sleep, activity and nutrition
exports.getAllFrontpage = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    const verifyer = verifyToken(idToken);

    verifyer.then(verify => {
      function getFitbit(paraUser, begintime, endtime) {
        return new Promise((resolve, reject) => {
          let activityResult = [];
          let activityQuery = db.collection("Fitbit");

          let fitbit = activityQuery
            .where("userID", "==", paraUser)
            .where("timestamp", ">", begintime.timestamp)
            .where("timestamp", "<", endtime.timestamp)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("error getting fitbit");
              }
              snapshot.forEach(doc => {
                activityResult.push(doc.data());
              });
            })
            .then(() => {
              resolve({ activity: activityResult });
            })
            .catch(err => {
              console.log("Error getting document from music", err);
              reject(err);
              return err;
            });
        });
      }
      /*Function for getting the fitbit objects from temp fitbit collection
       */
      function getSleep(paraUser, begintime, endtime) {
        return new Promise((resolve, reject) => {
          var sleepResult = [];
          let sleepQuery = db.collection("Sleep");

          let sleep = sleepQuery
            .where("userID", "==", paraUser)
            .where("timestamp", ">", begintime.timestamp)
            .where("timestamp", "<", endtime.timestamp)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Ërror getting sleep");
              }
              snapshot.forEach(doc => {
                sleepResult.push(doc.data());
              });
            })
            .then(() => {
              resolve({ sleep: sleepResult });
            })
            .catch(err => {
              console.log("Error getting document from sleep", err);
              reject(err);
              return err;
            });
        });
      }
      function getNutrition(paraUser, begintime, endtime) {
        return new Promise((resolve, reject) => {
          let nutritionResult = [];
          let nutritionQuery = db.collection("Nutrition");

          let nutrition = nutritionQuery
            .where("userID", "==", paraUser)
            .where("timestamp", ">", begintime.timestamp)
            .where("timestamp", "<", endtime.timestamp)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Nutrition fail document");
              }
              snapshot.forEach(doc => {
                nutritionResult.push(doc.data());
              });
            })
            .then(() => {
              resolve({ nutrition: nutritionResult });
            })
            .catch(err => {
              console.log("Error getting document from sleep", err);
              reject(err);
              return err;
            });
        });
      }

      if (verify.authenticated === true) {
        const getUser = verify.userid;

        let timeStamp = req.query.timestamp;

        let begintime = timestampHandler(timeStamp, "BEGINTIME");
        let endtime = timestampHandler(timeStamp, "ENDTIME");

        // Run fitbit getter and set object for adding to database
        Promise.all([getFitbit(getUser, begintime, endtime), getSleep(getUser, begintime, endtime),
        getNutrition(getUser, begintime, endtime)]).then(result => {
          for (item in result) {
            let dataObj = {};
            let fitObj = result[item];
          }
          return res.status(200).json({
            result: result
          });
        });
      }
    });
  });
});

// Get all markings targets for calendar
exports.getAllMarkings = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    console.log(idToken);

    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {

      function getMusic(getUser) {
        return new Promise((resolve, reject) => {
          var musicResult = [];
          let musicQuery = db.collection("Music");

          // eslint-disable-next-line promise/no-nesting
          let music = musicQuery
            .where("userID", "==", getUser)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Ërror getting music");
              }
              snapshot.forEach(doc => {
                musicResult.push(doc.get("timestamp"));
              });
            })
            .then(() => {
              resolve({ Music: musicResult });
            })
            .catch(err => {
              console.log("Error getting document from music", err);
              reject(err);
              return err;
            });
        });
      }

      function getMood(getUser) {
        return new Promise((resolve, reject) => {
          let moodResult = [];
          let moodQuery = db.collection("Mood");

          // eslint-disable-next-line promise/no-nesting
          let mood = moodQuery
            .where("userID", "==", getUser)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Mood fail document");
              }
              snapshot.forEach(doc => {
                moodResult.push(doc.get("timestamp"));
              });
            })
            .then(() => {
              resolve({ Mood: moodResult });
            })
            .catch(err => {
              console.log("Error getting document from mood", err);
              reject(err);
              return err;
            });
        });
      }

      function getSleep(getUser) {
        return new Promise((resolve, reject) => {
          var sleepResult = [];
          let sleepQuery = db.collection("Sleep");

          // eslint-disable-next-line promise/no-nesting
          let sleep = sleepQuery
            .where("userID", "==", getUser)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Ërror getting sleep");
              }
              snapshot.forEach(doc => {
                sleepResult.push(doc.get("timestamp"));
              });
            })
            .then(() => {
              resolve({ Sleep: sleepResult });
            })
            .catch(err => {
              console.log("Error getting document from sleep", err);
              reject(err);
              return err;
            });
        });
      }

      function getActivity(getUser) {
        return new Promise((resolve, reject) => {
          var activityResult = [];
          let activityQuery = db.collection("Fitbit");

          // eslint-disable-next-line promise/no-nesting
          let activity = activityQuery
            .where("userID", "==", getUser)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Ërror getting activity");
              }
              snapshot.forEach(doc => {
                activityResult.push(doc.get("timestamp"));
              });
            })
            .then(() => {
              resolve({ Activity: activityResult });
            })
            .catch(err => {
              console.log("Error getting document from activity", err);
              reject(err);
              return err;
            });
        });
      }

      function getNutrition(getUser) {
        return new Promise((resolve, reject) => {
          var nutritionResult = [];
          let nutritionQuery = db.collection("Nutrition");

          // eslint-disable-next-line promise/no-nesting
          let nutrition = nutritionQuery
            .where("userID", "==", getUser)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log("Ërror getting nutrition");
              }
              snapshot.forEach(doc => {
                nutritionResult.push(doc.get("timestamp"));
              });
            })
            .then(() => {
              resolve({ Nutrition: nutritionResult });
            })
            .catch(err => {
              console.log("Error getting document from nutrition", err);
              reject(err);
              return err;
            });
        });
      }

      if (verify.authenticated === true) {
        const getUser = verify.userid;

        Promise.all([getMusic(getUser), getMood(getUser), getActivity(getUser), getNutrition(getUser), getSleep(getUser)]).then(result => {
          return res.status(200).json({
            result: result
          });
        });
      }
    });
  });
});

// Function for registering mood
exports.registerFeedback = functions.https.onRequest((req, res) => {

  var getData = req.body.data;
  console.log(getData.data);
  let time = timestampHandler(getData.timestamp);
  getData.timestamp = time.timestamp;
  getData.week = time.week;
  getData.weekday = time.weekday;
  cors(req, res, () => {
    const idToken = req.headers["authorization"].split("Bearer ")[1];
    console.log(idToken);

    const verifyer = verifyToken(idToken);
    verifyer.then(verify => {
      console.log("Promise result ", verifyer);

      if (verify.authenticated === true) {

        const getUser = verify.userid;
        getData.userID = getUser;
        console.log("her er user:", getUser);
        if (getUser === undefined) {
          return res.status(401).json({
            error: "User is undefined"
          });
        } else {
          if (req.method !== "POST") {
            return res.status(418).json({
              message: "Only teaPOST allowed"
            });
          } else {

            let collection = "Feedback";
            let register = db
              .collection(collection)
              .add(getData)
              .then(ref => {
                console.log("Added document with ID: ", ref.id);
                return res.status(200).json({
                  toCollection: collection,
                  registeredData: getData
                });
              });
          }
        }
      }
    });
  });
});

/*
4: 1559661032
3: 1559574632
2: 1559488050
1: 1559401650
31: 1559315250
30: 1559228850
29: 1559142450
28: 1559056050
27: 1558969650
26: 1558883250
25: 1558796850
24: 1558710450
23: 1558624050
22: 1558537650
21: 1558451250
20: 1558364850
*/

//userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
exports.bigBertha = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    //dateExample: admin.firestore.Timestamp.fromDate(new Date('December 10, 1815')),
    var mood = [
      {
        comment: 'Pizza time.',
        mood: 'excellent',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558364850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 1
      },
      {
        comment: 'Had a stone in my shoe.',
        mood: 'neutral',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558451250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 2
      },
      {
        comment: 'Broccoli for dinner.',
        mood: 'sad',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558537650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 3
      },
      {
        comment: 'My grandmother died.',
        mood: 'terrible',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558624050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 4
      },
      {
        comment: 'I overslept.',
        mood: 'terrible',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558710450 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 5
      },
      {
        comment: 'Got an A on my exam.',
        mood: 'happy',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558796850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 6
      },
      {
        comment: 'Found 20 dollar!',
        mood: 'excellent',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558883250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 21,
        weekday: 7
      },
      {
        comment: 'Today I ate some great food',
        mood: 'happy',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558969650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 1
      },
      {
        comment: 'An avarage day',
        mood: 'neutral',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559056050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 2
      },
      {
        comment: 'Super sad, bc Amy was mean to me',
        mood: 'terrible',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559142450 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 3
      },
      {
        comment: 'Today is the best day of my life, I got the best job',
        mood: 'excellent',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559228850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 4
      },
      {
        comment: 'Things are hard at my new job',
        mood: 'neutral',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559315250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 5
      },
      {
        comment: 'Had my birthday, so I am happy',
        mood: 'excellent',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559401650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 6
      },
      {
        comment: 'Got to use mye presents!',
        mood: 'happy',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559488050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 22,
        weekday: 7
      },
      {
        comment: 'I had a bad time in the rain',
        mood: 'sad',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559574632 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 23,
        weekday: 1
      },
      {
        comment: 'Finished my exams',
        mood: 'happy',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559661032 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        week: 23,
        weekday: 2
      },
    ];
    var music = [
      {
        energy: 0.599,
        danceability: 0.817,
        valence: 0.548,
        artist: 'Survivor',
        title: 'Eye of the Tiger',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558364850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '2KH16WveTQWT6KOG9Rg6e2',
        week: 21,
        weekday: 1,
        year: 2019,
        mood: 'happy'
      },
      {
        energy: 0.659,
        danceability: 0.576,
        valence: 0.717,
        artist: 'AC/DC',
        title: 'Rock and Roll Ain\'t Noise Pollution',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558451250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '6J17MkMmuzBiIOjRH6MOBZ',
        week: 21,
        weekday: 2,
        year: 2019,
        mood: 'sad'
      },
      {
        energy: 0.401,
        danceability: 0.518,
        valence: 0.171,
        artist: 'Johnny Cash',
        title: 'Hurt',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558537650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '28cnXtME493VX9NOw9cIUh',
        week: 21,
        weekday: 3,
        year: 2019,
        mood: 'sad'
      },
      {
        energy: 0.020,
        danceability: 0.150,
        valence: 0.100,
        artist: 'Sad man',
        title: 'Sad song',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558624050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '2KH16WveTQWT6KOG9Rg6e2',
        week: 21,
        weekday: 4,
        year: 2019,
        mood: 'excellent'
      },
      {
        energy: 0.620,
        danceability: 0.576,
        valence: 0.121,
        artist: 'Jack in a box',
        title: 'This time',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558710450 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '6J17MkMmuzBiIOjRH6MOBZ',
        week: 21,
        weekday: 5,
        year: 2019,
        mood: 'terrible'
      },
      {
        energy: 0.100,
        danceability: 0.421,
        valence: 0.381,
        artist: 'Johnny Cash',
        title: 'Hurt',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558796850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '28cnXtME493VX9NOw9cIUh',
        week: 21,
        weekday: 6,
        year: 2019,
        mood: 'terrible'
      },
      {
        energy: 0.599,
        danceability: 0.817,
        valence: 0.548,
        artist: 'Survivor',
        title: 'Eye of the Tiger',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558883250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '2KH16WveTQWT6KOG9Rg6e2',
        week: 21,
        weekday: 7,
        year: 2019,
        mood: 'neutral'
      },
      {
        energy: 0.750,
        danceability: 0.200,
        valence: 0.689,
        artist: 'Metallica',
        title: 'Nothing else mattress',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558969650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '6J17MkMmuzBiIOjRH6MOBZ',
        week: 22,
        weekday: 1,
        year: 2019,
        mood: 'terrible'
      },
      {
        energy: 0.401,
        danceability: 0.518,
        valence: 0.171,
        artist: 'Lil Tomato',
        title: 'Fruit song',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559056050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '28cnXtME493VX9NOw9cIUh',
        week: 22,
        weekday: 2,
        year: 2019,
        mood: 'happy'
      },
      {
        energy: 0.900,
        danceability: 0.42,
        valence: 0.420,
        artist: 'Andy Harrison',
        title: 'Shine On',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559142450 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '2KH16WveTQWT6KOG9Rg6e2',
        week: 22,
        weekday: 3,
        year: 2019,
        mood: 'happy'
      },
      {
        energy: 0.555,
        danceability: 0.666,
        valence: 0.777,
        artist: 'Imaculature',
        title: 'Rock this town',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559228850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '6J17MkMmuzBiIOjRH6MOBZ',
        week: 22,
        weekday: 4,
        year: 2019,
        mood: 'sad'
      },
      {
        energy: 0.150,
        danceability: 0.200,
        valence: 0.988,
        artist: 'Jhonny Logan',
        title: 'Too cool',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559315250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '28cnXtME493VX9NOw9cIUh',
        week: 22,
        weekday: 5,
        year: 2019,
        mood: 'excellent'
      },
      {
        energy: 0.599,
        danceability: 0.817,
        valence: 0.548,
        artist: 'Survivor',
        title: 'Eye of the Tiger',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559401650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '2KH16WveTQWT6KOG9Rg6e2',
        week: 22,
        weekday: 6,
        year: 2019,
        mood: 'excellent'
      },
      {
        energy: 0.659,
        danceability: 0.576,
        valence: 0.717,
        artist: 'AC/DC',
        title: 'Rock and Roll Ain\'t Noise Pollution',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559488050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '6J17MkMmuzBiIOjRH6MOBZ',
        week: 22,
        weekday: 7,
        year: 2019,
        mood: 'happy'
      },
      {
        energy: 0.401,
        danceability: 0.518,
        valence: 0.171,
        artist: 'Johnny Cash',
        title: 'Hurt',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559574632 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '28cnXtME493VX9NOw9cIUh',
        week: 23,
        weekday: 1,
        year: 2019,
        mood: 'terrible'
      },
      {
        energy: 0.251,
        danceability: 0.766,
        valence: 0.171,
        artist: 'Brage Fosso',
        title: 'Gitbacit e kule',
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559661032 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
        id: '28cnXtME493VX9NOw9cIUh',
        week: 23,
        weekday: 2,
        year: 2019,
        mood: 'happy'
      },

    ];
    /*







*/
    var fitbit = [
      {
        calories: 1920,
        mood: 'excellent',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 1250,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558364850 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 1,
        year: 2019,
      },
      {
        calories: 1920,
        mood: 'sad',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 4265,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558451250 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 2,
        year: 2019,
      },
      {
        calories: 1815,
        mood: 'terrible',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2322,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558537650 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 3,
        year: 2019,
      },
      {
        calories: 1815,
        mood: 'happy',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 232,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558624050 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 4,
        year: 2019,
      },
      {
        calories: 1815,
        mood: 'neutral',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 4245,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558710450 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 5,
        year: 2019,
      },
      {
        calories: 1815,
        mood: 'excellent',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 4912,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558796850 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 6,
        year: 2019,
      },
      {
        calories: 1815,
        mood: 'excellent',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 3214,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558883250 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 21,
        weekday: 7,
        year: 2019,
      },
      {
        calories: 2342,
        mood: 'sad',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2425,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558969650 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 1,
        year: 2019,
      },
      {
        calories: 4215,
        mood: 'happy',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 8673,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559056050 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 2,
        year: 2019,
      },
      {
        calories: 1815,
        mood: 'terrible',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2322,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559142450 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 3,
        year: 2019,
      },
      {
        calories: 1325,
        mood: 'neutral',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2451,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559228850 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 4,
        year: 2019,
      },
      {
        calories: 2415,
        mood: 'neutral',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2415,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559315250 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 5,
        year: 2019,
      },
      {
        calories: 1256,
        mood: 'sad',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 1587,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559401650 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 6,
        year: 2019,
      },
      {
        calories: 1596,
        mood: 'excellent',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2109,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559488050 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 22,
        weekday: 7,
        year: 2019,
      },
      {
        calories: 289,
        mood: 'happy',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2404,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559574632 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 23,
        weekday: 1,
        year: 2019,
      },
      {
        calories: 450,
        mood: 'happy',
        goals: {
          activeminutes: 30,
          caloriesout: 2000,
          distance: 8.05,
          steps: 10000,
        },
        steps: 2800,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559661032 * 1000)),
        userID: "2EwPQNCYP0fm9ZAC8C15VQX6KAn1",
        week: 23,
        weekday: 2,
        year: 2019,
      },

    ];

    var nutrition = [
      {
        calories: 1000,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559661032 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 900,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559574632 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 2000,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559488050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 2200,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559401650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1900,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559315250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1600,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559228850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 2300,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559142450 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 2400,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559056050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1400,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558969650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1300,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558883250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1560,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558796850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1340,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558710450 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1480,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558624050 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1210,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558537650 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1900,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558451250 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
      {
        calories: 1570,
        goals: {
          calories: 2500
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558364850 * 1000)),
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1'
      },
    ];
    var sleep = [
      {
        duration: 7,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558364850 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 6,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558451250 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 9,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558537650 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 4,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558624050 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 5,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558710450 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 2,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558796850 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 11,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558883250 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 8,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1558969650 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 8,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559056050 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 7,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559142450 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 6,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559228850 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 7,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559315250 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 6,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559401650 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 9,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559488050 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 10,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559574632 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      }, {
        duration: 10,
        goals: {
          duration: 8
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(1559661032 * 1000)),//
        userID: '2EwPQNCYP0fm9ZAC8C15VQX6KAn1',
      },
    ];
    // Add a new document in collection "cities" with ID 'LA'
    var moodCollection = db.collection('Mood');
    var sleepCollection = db.collection('Sleep');
    var nutritionCollection = db.collection('Nutrition');
    var fitbitCollection = db.collection('Fitbit');
    var musicCollection = db.collection('Music');

    for (entry in mood) {
      moodCollection.add(mood[entry])
    }
    for (entry in sleep) {
      sleepCollection.add(sleep[entry])
    }
    for (entry in nutrition) {
      nutritionCollection.add(nutrition[entry])
    }
    for (entry in fitbit) {
      fitbitCollection.add(fitbit[entry])
    }
    for (entry in music) {
      musicCollection.add(music[entry])
    }
  });
});
/*
4: 1559661032
3: 1559574632
2: 1559488050
1: 1559401650
31: 1559315250
30: 1559228850
29: 1559142450
28: 1559056050
27: 1558969650
26: 1558883250
25: 1558796850
24: 1558710450
23: 1558624050
22: 1558537650
21: 1558451250
20: 1558364850
*/