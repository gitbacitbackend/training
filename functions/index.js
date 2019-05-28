/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
//https://us-central1-mmfapp-3603c.cloudfunctions.net/addMessage?text=
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

// Function for registering mood
exports.registerMood = functions.https.onRequest((req, res) => {
  // const getMood = req.query.mood;
  // const getUser = req.query.user;
  var getData = req.body.data;
  console.log(getData.data);
  // cors wrapper for cross platform(app) access
  let time = timestampHandler(getData.timestamp);
  getData.timestamp = time.timestamp;
  getData.week = time.week;
  getData.weekday = time.weekday;
  cors(req, res, () => {
    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);

    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
    if (verify.authenticated === true) {
      const getUser = verify.userid;
      getData.userID = getUser;
      console.log("her er user:", getUser);
      if (getUser === undefined) {
        return res.status(401).json({
          error: "User is undefined"
        })
      } else {
        if (req.method !== "POST") {
          return res.status(420).json({
            message: "Only POST allowed"
          });
        } else {
          let collection = "Mood";
          // let setDoc = db.collection(collection).doc(getUser).set(data);
          // eslint-disable-next-line promise/no-nesting
          let register = db
            .collection(collection)
            .add(getData)
            .then(ref => {
              console.log("Added document with ID: ", ref.id);
              return res.status(200).json({
                toCollection: collection,
                registeredData: getData
                // toUser: getUser,
                // toMood: getMood,
                // queryRes: result,
                // comment: getData
              });
            });
        }
      }
    }
  });

   
    // let data = {
    //   user: getUser,
    //   mood: getMood,
    //   time: getTime
    // };
  });
});

// [START basic_wildcard]
// Listen for creation of documents in the 'mood' collection
// Initiate spotify call from here
exports.registerData = functions.firestore
  // .runWith(runtimeOpts)
  .document("Mood/{userID}")
  .onCreate((snap, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    let newValue = snap.data();
    console.log(newValue);

    // access a particular field as you would any JS property
    let userID = newValue.userID;
    let mood = newValue.mood;
    let songs = "";
    let deleteSongs = [];
    var deleteFitbit = [];
    // Spotify identifyer information and new object to use for calls
    var spotify = new Spotify({
      id: "462be484f8f245d896aa9ebb64ffa482",
      secret: "b6b6d1b122ed4f2b8ae0ea1c1a826c1f"
    });
    // let query = db.collection("users").doc(userID);

    /* Function for database call to get user information
     */
    function getSpotifyID() {
      return new Promise((resolve, reject) => {
        query
          .get()
          .then(doc => {
            if (!doc.exists) {
              console.log("No such document!");
              reject(err);
              return err;
            } else {
              console.log("Document data:", doc.data());
              let songObj = {};
              songObj["spotifyID"] = doc.get("spotifyID");
              resolve(songObj);
              return songObj;
            }
          })
          .catch(err => {
            console.log("Error getting document", err);
            reject(err);
            return err;
          });
      });
    }

    /* Function for API call to spotify for getting audio features from track
    @param {string} id - id of song to be queried for
    */
    function getAudioFeatures(id) {
      return new Promise((resolve, reject) => {
        console.log("Started audio features analysis with ", songs, " : ", id);
        spotify
          .request("https://api.spotify.com/v1/audio-features?ids=" + id)
          .then(data => {
            console.log("Spotify data: ", data);
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

    /* Function for API call to spotify for getting track features
    @param {string} id - id of song to be queried for
    */
    function getTrack(id) {
      return new Promise((resolve, reject) => {
        console.log("Started shit");
        spotify
          .request("https://api.spotify.com/v1/tracks/" + id)
          .then(data => {
            console.log("Spotify track data: ", data);
            let songObj = {};
            // songObj["title"] = data.name;
            // songObj["artist"] = data.artists[0].name;
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

    // Promise for gettings songs form temp music collection.
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
              // doc.data() is never undefined for query doc snapshots
              // console.log(doc.id, " => ", doc.data());
              // console.log("Document data:", doc.data());
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

    // Run fitbit getter and set object for adding to database
    Promise.all([getFitbit()]).then(res => {
      // console.log(res);
      res = res[0];
      // console.log(res);
      for (item in res) {
        let dataObj = {};
        // console.log(res[item]);
        let fitObj = res[item];
        // dataObj.activityname = fitObj.activityname;

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
        // console.log(docID);
        // eslint-disable-next-line promise/no-nesting
        db.collection("Fitbit")
          .doc(docID)
          .create(dataObj)
          // eslint-disable-next-line no-loop-func
          .then(() => {
            // console.log("Adding this: ", dataObj);
            console.log("Fitbit Document updated or written with ID: ", docID);
            // console.log("With content: ", docRef);
            // return docRef;
          })
          // eslint-disable-next-line no-loop-func
          .catch(error => {
            // console.error("Error adding document: ", error);
            // return error;
          });
      }
      //DELETE fitbit
      for (item in deleteFitbit) {
        // console.log("DELETING:> ", item, " or ", deleteSongs[item]);
        db.collection("TempFitBit")
          .doc(deleteFitbit[item])
          .delete();
      }
    });
    // Promise resolving getSongs then handle the data from both getters. Resolve on adding merged item to database.
    Promise.all([getSongs()]).then(res => {
      // eslint-disable-next-line promise/no-nesting
      getAudioFeatures(songs).then(audioFeatures => {
        // console.log(songs);
        // console.log("Songs:> ", res);
        // console.log(res[0]);

        let tracks = res[0];
        // console.log(audioFeatures);
        for (item = 0; item < 3; item++) {
          // for (item in audioFeatures) {
          let songObj = {};
          songObj["energy"] = audioFeatures[item].energy;
          songObj["danceability"] = audioFeatures[item].danceability;
          songObj["valence"] = audioFeatures[item].valence;
          // console.log(audioFeatures[item]);
          // Object.assign(dataObj, audioFeatures[item], tracks[item]);
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
          // console.log(artistFull);
          // Object.assign(dataObj, songObj, tracks[item]);
          // console.log(res[0].item.toString());
          // Object.assign(songObj, res[item], audioFeatures[item]);
          // console.log(songObj);
          // eslint-disable-next-line promise/no-nesting
          db.collection("Music")
            .add(songObj)

            // eslint-disable-next-line no-loop-func
            .then(docRef => {
              // console.log("Adding this: ", dataObj);
              console.log("Spotify Document written with ID: ", docRef.id);
              // console.log("With content: ", docRef);
              // return docRef;
            })
            // eslint-disable-next-line no-loop-func
            .catch(error => {
              console.error("Error adding document: ", error);
              return error;
            });
        }
        // console.log(dataObj);
        for (item in deleteSongs) {
          // console.log("DELETING:> ", item, " or ", deleteSongs[item]);
          db.collection("TempMusic")
            .doc(deleteSongs[item])
            .delete();
        }
      });
    });
  });

// Function for querying music collection
exports.getMusic = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const getUser = req.query.userID;
    const getMood = req.query.mood;
    const getType = req.query.type;
    const query = db.collection("Music");

    // Get specific mood by user
    if (getUser !== undefined && getMood !== undefined) {
      let result = [];
      let users = query
        .where("userID", "==", getUser)
        .where("mood", "==", getMood)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(418).json({
              error: "No matching documents."
            });
          }
          snapshot.forEach(doc => {
            console.log(doc.id, "=>", doc.data());
            result.push(doc.data());
          });
          return res.status(200).json({
            restRes: result
          });
        })
        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return (res.status(420).json = {
            error: errmsg
          });
        });
    }
    // Get all music from user
    if (getUser !== undefined && getMood === undefined) {
      let result = [];
      let users = query
        .where("userID", "==", getUser)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(418).json({
              error: "No matching documents."
            });
          }
          snapshot.forEach(doc => {
            console.log(doc.id, "=>", doc.data());
            result.push(doc.data());
          });
          return res.status(200).json({
            restRes: result
          });
        })
        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return (res.status(420).json = {
            error: errmsg
          });
        });
    }

    // return res.status(200).json({
    //   searchFor: getUser,
    //   queryRes: result

    // });
  });
});

exports.getAllUsers = functions.https.onRequest((req, res) => {
  let collection = "users";
  let getUsers = db.collection(collection);
  let result = [];

  cors(req, res, () => {
    if (req.method !== "GET") {
      return res.status(420).json({
        message: "Only GET allowed"
      });
    }

    getUsers
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          console.log(doc.id, "=>", doc.data());
          result.push(doc.data());
        });
        return res.status(200).json({ users: result });
      })
      .catch(err => {
        console.log("Error getting documents", err);
      });
  });
});

exports.getOneUser = functions.https.onRequest((req, res) => {
  let getUserName = req.query.user;
  let getUser = db.collection("users").doc(getUserName);
  let result = [];

  cors(req, res, () => {
    if (req.method !== "GET") {
      return res.status(420).json({
        message: "Only GET allowed"
      });
    }

    var users = getUser
      .get()
      .then(doc => {
        if (!doc.exists) {
          console.log("No such document!");
          return res.status(404).json({ message: "No data" });
        } else if (result === !doc.exists) {
          return res.status(404).json({ message: "No data" });
        } else {
          console.log("Document data:", doc.data());
          result.push(doc.data());
        }
        return res.status(200).json({ result });
      })
      .catch(err => {
        console.log("Error getting documents", err);
      });
  });
});

exports.getMood = functions.https.onRequest((req, res) => {
  let collection = "Mood";
  let getMood = db.collection(collection);
  let result = [];

  cors(req, res, () => {
    if (req.method !== "GET") {
      return res.status(420).json({
        message: "Only GET allowed"
      });
    }

    getMood
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          console.log(doc.id, "=>", doc.data());
          result.push(doc.data());
        });
        return res.status(200).json({ Mood: result });
      })
      .catch(err => {
        console.log("Error getting documents", err);
      });
  });
});

//Gnurt:

exports.getDailyMusic = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const query = db.collection("DailyMusic");

    // const getSong = req.query.Song;
    // const getArtist = req.query.Artist;
    const getDateListened = req.query.DateListened;
    const getUser = req.query.UserID;
    //let date = new Date(getDateListened);

    if (getUser !== undefined && getDateListened !== undefined) {
      let result = [];
      let users = query
        .where("UserID", "==", getUser)
        .where("DateListened", "==", getDateListened)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(413).json({
              error: "No matching documents"
            });
          }
          snapshot.forEach(doc => {
            console.log("Song found");
            result.push(doc.data());
          });
          return res.status(200).json({
            Songsfordate: result
          });
        })
        .catch(err => {
          let errmsg = "error getting docs" + err;
          return res.status(416).json({
            error: errmsg
          });
        });
    }
    if (getUser !== undefined && getDateListened === undefined) {
      let result = [];

      let users = query
        .where("UserID", "==", getUser)
        .get()
        .then(snapshot => {
          if (snapshot.emtpy) {
            return res.status(404).json({
              error: "No match."
            });
          }
          snapshot.forEach(doc => {
            console.log("Song found");
            result.push(doc.data());
          });
          return res.status(200).json({
            Songs: result
          });
        })
        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return res.status(418).json({
            error: errmsg
          });
        });
    }
  });
});



exports.sendText = functions.https.onRequest((req, res) => {
  if (req.method !== "POST") {
    return res.status(500).json({
      message: "Not allowed, only POST requests is allowed"
    });
  }
  res.status(200).json({
    message: "Euraka!"
  });
});

exports.timetest = functions.https.onRequest((req, res) => {
  if (req.method !== "GET") {
    return res.status(405).send(`${req.method} method not allowed`);
  }

  /** if a query parameter doesn't arrive in the request, use a default fallback */
  // console.log("before: " + date);
  let date = req.query.date;
  let userID = req.query.user;
  // console.log("after: " + date);
  let beginTime = timestampHandler(date, "BEGINTIME");
  let endTime = timestampHandler(date, "ENDTIME");
  console.log("timeStamp: " + beginTime.toDate());

  let resTime = "";
  let collection = "Mood";
  // var addTime = db
  //   .collection(collection)
  //   .doc("timetest1")
  //   .set({ timestamp: firetime });

  let newRes = db
    .collection(collection)
    .where("timestamp", ">", beginTime.timestamp)
    .where("timestamp", "<", endTime.timestamp)
    .where("userID", "==", userID)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        // doc.data() is never undefined for query doc snapshots
        console.log(doc.id, " => ", doc.data());
        console.log(doc.get("timestamp").toDate());
      });
      return true;
    })
    .catch(error => {
      console.log("Error getting documents: ", error);
      return "test";
    });

  var getTime = db.collection(collection).doc("timetest1");
  var getDoc = getTime
    .get()
    .then(doc => {
      if (!doc.exists) {
        console.log("No such document!");
        return false;
      } else {
        // console.log("Document data:", doc.data());
        resTime = doc.get("timestamp");
        // console.log("Got time: " + resTime.toDate());
        // console.log(resTime.toMillis());
        return res.status(418).json({
          data: doc.data(),
          actualDate: date,
          fireStoreTime: beginTime.toDate(),
          endTime: endTime.toDate()
          // momented: moment.unix(firetime.toMillis()).format("DD/MM/YYYY HH:mm")
        });
      }
    })
    .catch(err => {
      console.log("Error getting document", err);
    });
});

/*
function for getting DailyMusic with UserID and DateListened as input, works with firestores timestamp
*/

exports.getDate = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let query = db.collection("DailyMusic");

    let getUser = req.query.UserID;

    let getDateFromUser = req.query.DateListened;

    let fireTime = admin.firestore.Timestamp.fromDate(
      new Date(getDateFromUser + "T00:00")
    );

    let endDate = admin.firestore.Timestamp.fromDate(
      new Date(getDateFromUser + "T23:59")
    );

    console.log("firetime is: ", fireTime);

    if (getUser !== undefined) {
      let result = [];
      let date = "";
      let toTimestamp = "";
      let users = query
        .where("UserID", "==", getUser)
        .where("DateListened", ">", fireTime)
        .where("DateListened", "<", endDate)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(413).json({
              error: "No matching documents"
            });
          }
          snapshot.forEach(doc => {
            result.push(doc.data());
            date = doc.get("DateListened");
            console.log(date.toDate());
            /*
          dateTo = date.toDate();
          console.log("etter toDate():", dateTo)
          toTimestamp = date.toMillis();
          console.log("gjør til timestamp:", toTimestamp)
          formattedDate = moment(toTimestamp).format('DD/MM/YYYY');
          console.log(formattedDate);
          */
          });
          return res.status(200).json({
            dateis: result
          });
        })
        .catch(err => {
          let errmsg = "error getting docs," + err;
          return res.status(416).json({
            error2: errmsg
          });
        });
    }
  });
});

//https://jsonplaceholder.typicode.com/users
exports.setData = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let fetch = require("node-fetch");
    //let data = require("./data.json");
    let collectionKey = "posts";
    let result = [];

    async function getData() {
      let data = await fetch("https://jsonplaceholder.typicode.com/todos");
      let main = await data.json();
      console.log(main);

      if (main && typeof main === "object") {
        Object.keys(main).forEach(docKey => {
          db.collection(collectionKey)
            .doc(docKey)
            .set(main[docKey])
            .then(res => {
              console.log("Document " + docKey + " written");

              /*if (req.method !== 'POST') {
            return res.status(500).json({
              message: "Not allowed, only POST requests is allowed",
              err1: err
            });
          }*/

              return null;
            })
            .catch(error => {
              console.log("Error writing: ", error);
              let errmsg = "Error getting documents" + error;
              return res.status(418).json({
                err2: errmsg
              });
            });
        });
      }
    }
    getData().catch(error => {
      console.log("Error writing: ", error);
      let errmsg = "Error getting documents" + error;
      return res.status(418).json({
        err3: errmsg
      });
    });

    let returnData = db.collection(collectionKey);
    returnData
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          console.log(doc.id, "=>", doc.data());
          result.push(doc.data());
        });
        return res.status(200).json({ json: "all good" });
      })
      .catch(err => {
        console.log("Error getting documents", err);
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

  if (timestamp !== undefined && timestamp.toString().length <= 10) {
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
    let fullTime = {};
    // console.log(typeof timestamp);
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

  //  console.log(date2);
}

/*
function for getting DailyMusic with UserID and DateListened where DateListened is in UNIX timestamp format
*/

exports.getDailyMusicUnix = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let query = db.collection("DailyMusic");

    let getUser = req.query.UserID;
    let getDateFromUser = req.query.DateListened;

    let unixStart = timestampHandler(getDateFromUser, "BEGINTIME");
    let unixEnd = timestampHandler(getDateFromUser, "ENDTIME");

    console.log(moment(unixStart).isoWeekday());
    console.log(moment(unixStart).isoWeek());

    if (getUser !== undefined) {
      let result = [];
      let users = query
        .where("UserID", "==", getUser)
        .where("DateListened", ">", unixStart.timestamp)
        .where("DateListened", "<", unixEnd.timestamp)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(413).json({
              error: "No matching documents"
            });
          }
          snapshot.forEach(doc => {
            result.push(doc.data());
          });
          return res.status(200).json({
            dateis: result
          });
        })

        .catch(err => {
          let errmsg = "error getting docs," + err;
          return res.status(416).json({
            error2: errmsg
          });
        });
    }
  });
});

exports.getDailyMoodUnix = functions.https.onRequest((req, res) => {
  cors(req, res, () => {

    let query = db.collection("Mood");

    //let getuser = req.query.userID;
    let timeStamp = req.query.timestamp;
    console.log(timeStamp);

    let unixStart = timestampHandler(timeStamp, "BEGINTIME");
    let unixEnd = timestampHandler(timeStamp, "ENDTIME");

    console.log(unixStart.timestamp);
    console.log(unixEnd.timestamp);

    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);

    // calls verifytoken() with the idToken from Header 
    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
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
            return res.status(413).json({
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
          return res.status(416).json({
            error2: errmsg
          });
        });
    }
  }
  })
  });
});


exports.getMusicWeek = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const query = db.collection("statsMusic");
    const getWeekID = req.query.weekID;
    const getUserID = req.query.userID;

    if (getWeekID !== undefined) {
      let result = [];
      let valence = [];
      let energy = [];
      let danceability = [];
      let mood = [];
      let tempmood = [];
      let sum = 0;
      let fulldata = [];
      let date = [];
      let array = [{dayID: "1"}];
      let counter = 0;

      let music = query
        .where("weekID", "==", getWeekID)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(413).json({
              error: "No document for this weekID"
            });
          }
          snapshot.forEach(doc => {
          
            
            day = doc.get("dayID");
            unixTime = new Date(doc.get("timestamp")._seconds*1000);

          

            year = unixTime.getFullYear();
            month =(unixTime.getMonth()+1);
            day = (unixTime.getDate());
            
            valence.push(doc.get("dayID") + ":" + doc.get("Valence"));
            energy.push(doc.get("dayID") + ":" + doc.get("Energy"));
            danceability.push(doc.get("dayID") + ":" + doc.get("Danceability"));
            mood.push(doc.get("dayID")+ ":" + doc.get("Mood"));
            date.push(doc.get("dayID")+ ":" + year + "-" + month + "-" + day);

            array.forEach((item)=>{
  
              if(doc.get("dayID") in array){
                return null
              } else {
                array.push({dayID: doc.get("dayID")})
                counter ++;
              }
            })

            sum++;
            })
           
          for (i = 1; i <= array.length - 1; i++) {
            var valenceSum = 0;
            var energySum = 0;
            var danceabilitySum = 0;
            var valenceAntall = 0;
            var energyAntall = 0;
            var danceabilityAntall = 0;
            var tempdate = "";
            tempmood = [];
          

            mood.forEach(item =>{
              if(parseInt(item.split(":")[0]) === i){
                m = item.split(":")[1];
                tempmood.push(m);
              }
            });

            date.forEach(item =>{
              if(parseInt(item.split(":")[0]) === i){
                d = item.split(":")[1];
                tempdate = String(d);
              }
            });

            valence.forEach(item => {
              if (parseInt(item.split(":")[0]) === i) {
                valenceSum = valenceSum + parseInt(item.split(":")[1]);
                valenceAntall++;
              }
            });

            valenceSum = valenceSum / valenceAntall;
            var resultValence = valenceSum.toFixed(0);
            
            energy.forEach(item => {
              if (parseInt(item.split(":")[0]) === i) {
                energySum = energySum + parseInt(item.split(":")[1]);
                energyAntall++;
              }
            });
            energySum = energySum / energyAntall;
            var resultEnergy = energySum.toFixed(0);
            
            var summen = 0;
            var antall = 0;

            danceability.forEach(item => {
              if (parseInt(item.split(":")[0]) === i) {
                danceabilitySum = danceabilitySum + parseInt(item.split(":")[1]);
                danceabilityAntall++;
              }
            });
            danceabilitySum = danceabilitySum / danceabilityAntall;
            var resultDanceability = danceabilitySum.toFixed(0);

            fulldata.push({
              Energy: resultEnergy,
              Danceability: resultDanceability,
              Valence: resultValence,
              dayID: i,
              mood: tempmood,
              date: tempdate,
              });
          }

          var obj = JSON.parse(JSON.stringify(fulldata));

          return res.status(200).json({
            MusicStats: obj
          });
        })

        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return res.status(416).json({
            error: errmsg
          });
        });
    }
  });
});

exports.deleteCollection = functions.https.onRequest((req, res) => {
  let deletions = [];
  let incomming = 0;
  let deleted = 0;
  db.collection(req.query.collection)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        // console.log(doc.id);
        deletions.push(doc.id);
        incomming++;
      });
    })
    .then(() => {
      console.log("Deleting this many: ", incomming);
      for (doc in deletions) {
        db.collection(req.query.collection)
          .doc(deletions[doc])
          .delete();
        deleted++;
      }
    })
    .then(() => {
      console.log("Deleted this many: ", deleted);
      return res.status(200).json({
        Deleted: deleted,
        Incomming: incomming
      });
    })
    .catch(err => {
      console.log("Error getting documents", err);
    });
});

// TODO : Change for authentication component token verification
exports.tempDigiMe = functions.https.onRequest((req, res) => {
  //console.log(req.body.data);
  let obj = req.body.data;
  const getUser = req.query.userID;
  // console.log("OBJECT BEFORE", obj);
  // console.log("Object lenght", Object.keys(obj).length);
  // console.log("last Object", obj[obj.length - 1]);
  var DigiObj = {};
  for (entry in obj) {
    console.log(JSON.parse(obj[entry]));
    Object.assign(DigiObj, JSON.parse(obj[entry]));
  }
  // for (const key of Object.keys(obj)) {
  //   console.log(key, obj[key]);
  // }
  // var DigiObj = JSON.parse(obj);
  console.log("AFTER", DigiObj);
  // console.log(DigiObj.length);

  cors(req, res, () => {
    let promises = [];
    let fitPromises = [];
    if (req.method !== "POST") {
      return res.status(420).json({
        message: "Only POST allowed"
      });
    } else {
      for (key in DigiObj) {
        if (key === "spotify") {

          var resObj = {};
          var spotifyObj = DigiObj.spotify;
          for (items in spotifyObj) {
            // console.log(items);
            let oneSong = spotifyObj[items];
            // console.log(oneSong);
            // console.log(items);
            //console.log(DigiObj[items]);
            // console.log(MusicObj[0][items]);
  
            // console.log(MusicObj[items].track);
            let trackObj = spotifyObj[items].track;
            let dataObj = {};
            // const getUser = req.query.userID;
            // const getTime = req.query.timestamp;
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
      }
        else if (key === "fitbit") {

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
                db.collection(collection)
                  .add(fitbitObj[items])
                  // eslint-disable-next-line no-loop-func
                  .then(ref => {
                    console.log("Added document with ID: ", ref.id);
                    // Object.assign(resObj, fitbitObj[items]);
                    resolve();
                  });
              });
            }
          }

        }
      }

      Promise.all(fitPromises, promises).then(() => {
        console.log("All resolved");
        return res.status(200).json({
          DataAdded: "ok"
        });
      });
    }
  });
});

exports.tempData = functions.https.onRequest((req, res) => {
  let obj = req.body.data;

  var DigiObj = {};
  for (entry in obj) {
    console.log(JSON.parse(obj[entry]));
    Object.assign(DigiObj, JSON.parse(obj[entry]));
  }

  cors(req, res, () => {
    let promises = [];
    if (req.method !== "POST") {
      return res.status(420).json({
        message: "Only POST allowed"
      });
    } else {
      let dataObj = {};
      const getUser = req.query.userID;
      dataObj["userID"] = getUser;
      let collection = "TempData";
      var register = new Promise(resolve => {
        promises.push(register);
        db.collection(collection)
          .add(DigiObj)
          .then(ref => {
            console.log("Added document with ID: ", ref.id);
            Object.assign(dataObj);
            resolve();
          });
      });
    }
    Promise.all(promises).then(() => {
      return res.status(200).json({
        DataAdded: "ok"
      });
    });
  });
});



exports.getFitbit = functions.https.onRequest((req, res) => {
  cors(req, res, () => {

    //const getUser = req.query.userID;
    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);
    const getWeek = parseInt(req.query.weekID);
    console.log("Her er uken: "  + getWeek)

    const query = db.collection("Fitbit");

    // calls verifytoken with the idToken from Header 
    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
    if (verify.authenticated === true) {
      const getUser = verify.userid;

      console.log("her er user:", getUser);
 
      let result = [];
      // eslint-disable-next-line promise/no-nesting
      let users = query
        .where("userID", "==", getUser)
        .where("week", "==", getWeek)
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
              console.log(doc.id, "=>", doc.data());
              result.push(doc.data());
            });
            if(snapshot.empty) {
              return res.status(418).json({
                error: "No matching documents."
          })
        }
            return res.status(200).json({
              Fitbit: result
            });
            
        }).catch(err => {
          let errmsg = "Error getting documents" + err;
          return (res.status(420).json = {
            error: errmsg
          });
        }); 
  
        

       // if user is undefined 
    
    if (getUser === undefined) {
      return res.status(401).json({
        error: "User is undefined"
      })
    }
    /*
    // Get all fit from user
    if (getUser !== undefined && getWeek === undefined) {
      let result = [];
      // eslint-disable-next-line promise/no-nesting
      let users = query
        .where("userID", "==", getUser)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(418).json({
              error: "No matching documents."
            });
          }
          snapshot.forEach(doc => {
           
            result.push(doc.data());
          });
          return res.status(200).json({
            Fitbit: result
          });
        })
        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return (res.status(420).json = {
            error: errmsg
          });
        });
    }
*/
    // return res.status(200).json({
    //   searchFor: getUser,
    //   queryRes: result

    // });
    }
  });

});
});

exports.getUserInfo = functions.https.onRequest((req, res) => {
  cors(req, res, () => {

    let uid = req.query.id;

   admin.auth().getUser(uid)
   .then((userRecord) => {
     // See the UserRecord reference doc for the contents of userRecord.
     console.log('Successfully fetched user data:', userRecord.toJSON());
     return res.status(200).json({
        user: userRecord
     })
   })
   .catch((error) => {
     console.log('Error fetching user data:', error);
   });
  });
});


exports.getMusicWeekDigiB = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const query = db.collection("Music");
    const getWeekID = parseInt(req.query.week);
    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);
    //const getUserID = req.query.userID;

    // calls verifytoken with the idToken from Header 
    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
    if (verify.authenticated === true) {
      const getUser = verify.userid;

      console.log("her er user:", getUser);
      if (getUser === undefined) {
        return res.status(401).json({
          error: "User is undefined"
        })
      }else 
      
      if (getWeekID !== undefined) {
      let result = [];
      let valence = [];
      let energy = [];
      let danceability = [];
      let mood = [];
    //  let tempmood = [];
      let sum = 0;
      let fulldata = [];
      let date = [];
      let array = [{weekday: "1"}];
      let checker = [];
      let counter = 0;

      // eslint-disable-next-line promise/no-nesting
      let music = query
        .where("week", "==", getWeekID)
        .where("userID", "==", getUser)
        .orderBy("weekday", "desc")
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(413).json({
              error: "No document for this weekID"
            });
          }
          snapshot.forEach(doc => {
          
        //    array.push({weekday: doc.get("weekday")[0]});
            
            day = doc.get("weekday");
            unixTime = new Date(doc.get("timestamp")._seconds*1000);

          

            year = unixTime.getFullYear();
            month =(unixTime.getMonth()+1);
            day = (unixTime.getDate());
            
            valence.push(doc.get("weekday") + ":" + doc.get("valence"));
            energy.push(doc.get("weekday") + ":" + doc.get("energy"));
            danceability.push(doc.get("weekday") + ":" + doc.get("danceability"));
            date.push(doc.get("weekday")+ ":" + year + "-" + month + "-" + day);
            mood.push(doc.get("weekday")+ ":" + doc.get("mood"));
         
            if ( ! checker.includes(doc.get("weekday"))) {
              checker.push(doc.get("weekday"))
            }

            checker.forEach((item)=>{
             
              if(doc.get("weekday") in checker){
                counter ++;
              }
            })
            })
          
          while (checker.length) {
            var valenceSum = 0;
            var energySum = 0;
            var danceabilitySum = 0;
            var valenceAntall = 0;
            var energyAntall = 0;
            var danceabilityAntall = 0;
            var tempdate = "";
            let p = checker.pop();
            //  var i = 0;
            tempmood = [];
          
          
            // eslint-disable-next-line no-loop-func
            mood.forEach(item =>{
              if(parseInt(item.split(":")[0]) === p){
                m = item.split(":")[1];
                tempmood.push(m);
              }
            });
            

            // eslint-disable-next-line no-loop-func
            date.forEach(item =>{
              if(parseInt(item.split(":")[0]) === p){
                d = item.split(":")[1];
                tempdate = String(d);
              }
            });

            // eslint-disable-next-line no-loop-func
            valence.forEach(item => {
              if (parseInt(item.split(":")[0]) === p) {
                valenceSum = valenceSum + parseFloat(item.split(":")[1]);
                valenceAntall++;
              }
            });

            valenceSum = valenceSum / valenceAntall;
            var resultValence = valenceSum.toFixed(2)*100;
            
            // eslint-disable-next-line no-loop-func
            energy.forEach(item => {
              if (parseInt(item.split(":")[0]) === p) {
                energySum = energySum + parseFloat(item.split(":")[1]);
                energyAntall++;
              }
            });
            energySum = energySum / energyAntall;
            var resultEnergy = energySum.toFixed(2)*100;
            
            var summen = 0;
            var antall = 0;

            // eslint-disable-next-line no-loop-func
            danceability.forEach(item => {
              if (parseInt(item.split(":")[0]) === p) {
                danceabilitySum = danceabilitySum + parseFloat(item.split(":")[1]);
                danceabilityAntall++;
              }
            });
            danceabilitySum = danceabilitySum / danceabilityAntall;
            var resultDanceability = danceabilitySum.toFixed(2)*100;


            fulldata.push({
              Energy: resultEnergy,
              Danceability: resultDanceability,
              Valence: resultValence,
              weekday: p,
              date: tempdate,
              mood: tempmood,
              });
          }       
          var obj = JSON.parse(JSON.stringify(fulldata));

          return res.status(200).json({
            MusicStats: obj
          });
        })

        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return res.status(416).json({
            error: errmsg
          });
        });
    }
  }
  });
});
});

exports.getProfile = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // idToken comes from the client app

   // const getUser = parseInt(req.query.userID);
    const query = db.collection("Profile");
    //Splits the String so that Bearer goes away. TODO: Only allow if bearer is apart of the String
    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);

    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
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
              return res.status(418).json({
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
            return (res.status(420).json = {
              error: errmsg
            });
          });
      }
    }
  });
  })
});

 function verifyToken(idToken) {
  return new Promise(resolve => {
    admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
      var uid = decodedToken.uid;
      console.log("uid er: " + uid);
      resolve( {authenticated: true, userid: uid})
      // ...
    }).catch((error) => {
      // Handle error
      console.log("Error authenticating user", error)
      resolve ( {authenticated: false, userid: ""})
    });
  });
    // idToken comes from the client app

    // Move to Funcs
    // const getUser = parseInt(req.query.userID);
    // //Splits the String so that Bearer goes away. TODO: Only allow if bearer is apart of the String
    // const idToken = req.headers['authorization'].split('Bearer ')[1];
    // console.log(idToken);

    //verifies the token recieved with the header. TODO: Only respond with data that matches the uid..
}

exports.getAllMusic = functions.https.onRequest((req, res) => {
  cors(req, res, () => {

    const query = db.collection("Music");
    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);

    const getTime = req.query.timestamp;

    let unixStart = timestampHandler(getTime, "BEGINTIME");
    let unixEnd = timestampHandler(getTime, "ENDTIME");

   // calls verifytoken with the idToken from Header 
    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
    if (verify.authenticated === true) {
      const getUser = verify.userid;

      console.log("her er user:", getUser);
      if (getUser === undefined) {
        return res.status(401).json({
          error: "User is undefined"
        })
      }
      if (getTime === undefined) {
        return res.status(401).json({
          error: "Error setting time"
        })
      }
    // Get specific mood by user
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
            return res.status(418).json({
              error: "No matching documents."
            });
          }
          snapshot.forEach(doc => {
            
            //result.push(doc.data());

            if(doc.get("mood") === "happy"){
              happy.push(doc.data());
            } else if(doc.get("mood") === "sad"){
              sad.push(doc.data())
            } else {
              neutral.push(doc.data())
            }

         
          });
            console.log("HAPPY : "+happy)
            console.log("SAD : "+ sad)
            console.log("NEUTRAL:" + neutral)

            result = {
              "happy":happy,
              "sad":sad,
              "neutral":neutral,
            }
        

          return res.status(200).json({
            Mood:result
          });
        })

        .catch(err => {
          let errmsg = "error getting docs," + err;
          return res.status(416).json({
            error2: errmsg
          });
        });
    }
  }
});
});
});

exports.getAllMood = functions.https.onRequest((req, res) => {
  cors(req, res, () => {

    const idToken = req.headers['authorization'].split('Bearer ')[1];
    console.log(idToken);

    let query = db.collection("Mood");
    //let getUser = req.query.userID;
    let array = [];

    const verifyer = verifyToken(idToken);
    verifyer.then((verify) => {
      console.log("Promise result ", verifyer)
   
    if (verify.authenticated === true) {
      const getUser = verify.userid;

      let result = [];
      // eslint-disable-next-line promise/no-nesting
      let users = query
        .where("userID", "==", getUser)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            return res.status(413).json({
              error: "No matching documents"
            });
          }
          snapshot.forEach(doc => {        
         function Unix_timestamp(t){
            var dt = new Date(t*1000);
            var year = dt.getFullYear();
            var m =  String(dt.getMonth() + 1);
            var d =  String(dt.getDate());

            if(m.length === 1){
              month = "0" + m
            } else {
              month = m
            }
            if(d.length === 1){
              day = "0" + d
            } else {
              day = d
            }
            return year + '-' + month + '-' + day;  
          }
            array.push(
              {
              mood: doc.get("mood"),
              timestamp: Unix_timestamp(doc.get("timestamp")._seconds),
              });

            result.push(doc.data());
          });
          return res.status(200).json({
            Mood: array
          });
        })
        .catch(err => {
          let errmsg = "error getting docs," + err;
          return res.status(416).json({
            error2: errmsg
          });
        });
    }  
  });
});
});

exports.getAllFrontpage = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let sleepResult = [];
    let nutritionResult = [];
    let activityResult = [];


    let getuser = req.query.userID;
    let timeStamp = req.query.timestamp;

    let begintime = timestampHandler(timeStamp, "BEGINTIME");
    let endtime = timestampHandler(timeStamp, "ENDTIME");

    console.log(begintime.timestamp);
    console.log(endtime.timestamp);

    function getFitbit() {
      return new Promise((resolve, reject) => {
        let activityResult = [];
        let activityQuery = db.collection("Fitbit");

        let fitbit = activityQuery
          .where("userID", "==", getuser)
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
            resolve({activity: activityResult});
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
    function getSleep() {
      return new Promise((resolve, reject) => {
        var sleepResult = [];
        let sleepQuery = db.collection("Sleep");

        let sleep = sleepQuery
        .where("userID", "==", getuser)
        .where("timestamp", ">", begintime.timestamp)
        .where("timestamp", "<", endtime.timestamp)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            console.log("Ërror getting sleep")
          }
          snapshot.forEach(doc => {
            sleepResult.push(doc.data());
          })
            })
          .then(() => {
            resolve({sleep: sleepResult});
          })
          .catch(err => {
            console.log("Error getting document from sleep", err);
            reject(err);
            return err;
          });
        })
    }
    function getNutrition() {
      return new Promise((resolve, reject) => {
        let nutritionResult = [];
        let nutritionQuery = db.collection("Nutrition");

        let nutrition = nutritionQuery
          .where("userID", "==", getuser)
          .where("timestamp", ">", begintime.timestamp)
          .where("timestamp", "<", endtime.timestamp)
          .get()
          .then(snapshot => {
            if (snapshot.empty) {
              console.log("Nutrition fail document");
            }
            snapshot.forEach(doc => {
              nutritionResult.push(doc.data());
            })
          })
          .then(() => {
            resolve({nutrition: nutritionResult});
          })
          .catch(err => {
            console.log("Error getting document from sleep", err);
            reject(err);
            return err;
          });
        
    })
  }

    // Run fitbit getter and set object for adding to database
    Promise.all([getFitbit(), getSleep(), getNutrition()]).then(result => {

      for (item in result) {
        let dataObj = {};
        console.log(result[item]);
        let fitObj = result[item];
      } 

      return res.status(200).json({
        result: result
      });

    });
  });
});


exports.getMusicAndMood = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    let moodResult = [];
    let musicResult = [];

    //let getuser = req.query.userID;

        //Splits the String so that Bearer goes away. TODO: Only allow if bearer is apart of the String
        const idToken = req.headers["authorization"].split("Bearer ")[1];
        console.log(idToken);
    
        const verifyer = verifyToken(idToken);
        verifyer.then(verify => {
          console.log("Promise result ", verifyer);
    
          if (verify.authenticated === true) {
            const getUser = verify.userid;

    /*Function for getting the fitbit objects from temp fitbit collection
     */
    function getMusic() {
      return new Promise((resolve, reject) => {
        var musicResult = [];
        let musicQuery = db.collection("Music");

        let music = musicQuery
        .where("userID", "==", getUser)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            console.log("Ërror getting music")
          }
          snapshot.forEach(doc => {
            musicResult.push(doc.get("timestamp"));

          })
            })
          .then(() => {
            resolve({Music: musicResult});
          })
          .catch(err => {
            console.log("Error getting document from music", err);
            reject(err);
            return err;
          });
        })
    }
    
    function getMood() {
      return new Promise((resolve, reject) => {
        let moodResult = [];
        let moodQuery = db.collection("Mood");

        let mood = moodQuery
          .where("userID", "==", getUser)
          .get()
          .then(snapshot => {
            if (snapshot.empty) {
              console.log("Mood fail document");
            }
            snapshot.forEach(doc => {

              moodResult.push(doc.get("timestamp"));

            })
          })
          .then(() => {
            resolve({Mood: moodResult});
          })
          .catch(err => {
            console.log("Error getting document from mood", err);
            reject(err);
            return err;
          });
        
    })
  }

    // Run fitbit getter and set object for adding to database
    Promise.all([getMusic(), getMood()]).then(result => {

      for (item in result) {
        let dataObj = {};
        console.log(result[item]);
        let fitObj = result[item];
      } 

      return res.status(200).json({
        result: result
      });

    });
  }});
  });
});
