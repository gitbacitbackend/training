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
// Take the text parameter passed to this HTTP endpoint and insert it into the
// Realtime Database under the path /messages/:pushId/original
exports.addMessage = functions.https.onRequest((req, res) => {
  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into the Realtime Database using the Firebase Admin SDK.
  return admin
    .database()
    .ref("/messages")
    .push({ original: original })
    .then(snapshot => {
      // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
      return res.redirect(303, snapshot.ref.toString());
    });
});

// Listens for new messages added to /messages/:pushId/original and creates an
// uppercase version of the message to /messages/:pushId/uppercase
exports.makeUppercase = functions.database
  .ref("/messages/{pushId}/original")
  .onCreate((snapshot, context) => {
    // Grab the current value of what was written to the Realtime Database.
    const original = snapshot.val();
    console.log("Uppercasing", context.params.pushId, original);
    const uppercase = original.toUpperCase();
    // You must return a Promise when performing asynchronous tasks inside a Functions such as
    // writing to the Firebase Realtime Database.
    // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
    return snapshot.ref.parent.child("uppercase").set(uppercase);
  });

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
exports.jsonMessage = functions.https.onRequest((req, res) => {
  // cors wrapper for cross platform(app) access
  cors(req, res, () => {
    const original = req.query.text;
    //console.log('Uppercasing', context.params.pushId, original);
    // You must return a Promise when performing asynchronous tasks inside a Functions such as
    // writing to the Firebase Realtime Database.
    // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
    res.status(200).json({
      sampleTime: "1450632410296",
      data: "76.36731:3.4651554:0.5665419",
      text: original
    });
  });

  //return data;
});

// Function for registering mood
exports.registerMood = functions.https.onRequest((req, res) => {
  // const getMood = req.query.mood;
  // const getUser = req.query.user;
  const getData = req.body;
  // cors wrapper for cross platform(app) access
  cors(req, res, () => {
    if (req.method !== "POST") {
      return res.status(420).json({
        message: "Only POST allowed"
      });
    } else {
      let collection = "Mood";
      // let setDoc = db.collection(collection).doc(getUser).set(data);
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

exports.registerMusic = functions.firestore
  // .runWith(runtimeOpts)
  .document("Mood/{userID}")
  .onCreate((snap, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    let newValue = snap.data();

    // access a particular field as you would any JS property
    let userID = newValue.userID;
    let songs = "";
    let deleteSongs = [];
    // Spotify identifyer information and new object to use for calls
    var spotify = new Spotify({
      id: "462be484f8f245d896aa9ebb64ffa482",
      secret: "b6b6d1b122ed4f2b8ae0ea1c1a826c1f"
    });
    let query = db.collection("users").doc(userID);

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
        console.log("Started audio features analysis");
        spotify
          .request("https://api.spotify.com/v1/audio-features?ids=" + id)
          .then(data => {
            console.log("Spotify data: ", data);
            let songObj = {};
            // songObj["energy"] = data.energy;
            // songObj["danceability"] = data.danceability;
            // songObj["valence"] = data.valence;
            // console.log(songObj);
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

    /* Handle the promises from all queries and API calls
    @param {object} staticObj - object in JSON format with values to be inserted in database
    */
    function promise(staticObj) {
      // console.log(staticObj.id);
      console.log("Promises reached", staticObj.id);

      Promise.all([
        // getSpotifyID(),
        getAudioFeatures(staticObj.id),
        getTrack(staticObj.id)
      ]).then(result => {
        console.log("Result from promise: ", result);

        // result comes in form of array, itterate over and assign to object
        let resObj = {};
        for (index in result) {
          Object.assign(resObj, result[index]);
        }

        let songObj = {};
        Object.assign(songObj, resObj, staticObj);

        // Add results to database
        // eslint-disable-next-line promise/no-nesting
        db.collection("Music")
          .add(songObj)
          .then(docRef => {
            console.log("Adding this: ", songObj);
            console.log("Document written with ID: ", docRef.id);
            // console.log("With content: ", docRef);
            return docRef;
          })
          .catch(error => {
            console.error("Error adding document: ", error);
            return error;
          });
      });
    }

    function getSongs() {
      return new Promise((resolve, reject) => {
        var spotres = [];
        let songObj = {};

        let getStoredMusic = db
          .collection("TempMusic")
          .where("userID", "==", userID);
        getStoredMusic
          .get()
          .then(querySnapshot => {
            querySnapshot.forEach(doc => {
              // doc.data() is never undefined for query doc snapshots
              console.log(doc.id, " => ", doc.data());
              // console.log("Document data:", doc.data());
              // spotres.push(doc.data());
              deleteSongs.push(doc.id);
              // promise(res[item]);

              if (songs === "") {
                songs += doc.get("id");
              } else {
                songs += "," + doc.get("id");
              }
              spotres.push(doc.data());
              // Object.assign(songObj, doc.data());

              return doc.data();
            });
          })
          .then(() => {
            // console.log("resolved", spotres[0]);
            // console.log("resolved 2", spotres[1]);
            // console.log("resolved 3", spotres[2]);
            // for (item in spotres) {
            //   Object.assign(songObj, spotres[item]);
            //   console.log(spotres[item]);
            // }
            // console.log(spotres);
            resolve(spotres);
          })
          .catch(err => {
            console.log("Error getting document", err);
            reject(err);
            return err;
          });
      });
    }
    // getSongs().then(() => {
    //   console.log(spotres);
    //   // Itterate through objects in result from spotify history
    //   // for (res in spotres.items) {
    //   //   // console.log(spotres.items[res]);
    //   //   let song = spotres.items[res].track;
    //   //   // console.log(song.artists[0].id);
    //   for (res in spotres) {
    //     // console.log(spotres.items[res]);
    //     let song = spotres[res];
    //     // console.log(song.artists[0].id);
    //     console.log(song.name);
    //     let artist = song.artists;
    //     var artistFull = "";
    //     for (entry in artist) {
    //       // console.log(artist[entry].name)
    //       if (artistFull === "") {
    //         artistFull += artist[entry].name;
    //       } else {
    //         artistFull += ", " + artist[entry].name;
    //       }
    //     }
    //     console.log(artistFull);

    //     let songObj = {};
    //     // spotres["userID"] = userID;
    //     // let playedSong = song["played_at"];
    //     let firedate = song["timestamp"];
    //     let fireweek = song["week"];
    //     let fireday = song["weekday"];

    //     songObj["timestamp"] = firedate;
    //     songObj["weekday"] = fireday;
    //     songObj["week"] = fireweek;
    //     songObj["id"] = song["id"];
    //     songObj["userID"] = userID;
    //     songObj["artist"] = artistFull;

    //     console.log("Full obj", songObj);
    //     // Call promise handler to inititate promise funcs
    //     promise(songObj);
    //   }
    // });
    var songArr = [];
    var songObj = {};

    // getSongs().then(res => {
    //   for (item in res) {
    //     console.log("Starting promise with: ", res[item]);
    //     // promise(res[item]);

    //     if (songs === "") {
    //       songs += res[item].id;
    //     } else {
    //       songs += "," + res[item].id;
    //     }
    //   }
    //   songArr = res;
    // });

    Promise.all([getSongs()]).then(res => {
      // eslint-disable-next-line promise/no-nesting
      getAudioFeatures(songs).then(audioFeatures => {
        // console.log(songs);
        // console.log("Songs:> ", res);
        // console.log(res[0]);
        let tracks = res[0];
        // console.log(audioFeatures);
        for (item in audioFeatures) {
          var dataObj = {};

          // console.log(audioFeatures[item]);
          Object.assign(dataObj, audioFeatures[item], tracks[item]);
          // console.log(res[0].item.toString());
          // Object.assign(songObj, res[item], audioFeatures[item]);
          // console.log(songObj);
          // eslint-disable-next-line promise/no-nesting
          db.collection("Music")
            .add(dataObj)
            // eslint-disable-next-line no-loop-func
            .then(docRef => {
              // console.log("Adding this: ", dataObj);
              console.log("Document written with ID: ", docRef.id);
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
        //   for (item in tracks) {
        //     console.log(tracks[item]);
        //     Object.assign(dataObj, audioFeatures[item], tracks[item]);
        //   }
        //   console.log(dataObj);
        // });

        // .then(() => {
        //   // eslint-disable-next-line promise/no-nesting
        //   db.collection("Music")
        //     .add(songObj)
        //     .then(docRef => {
        //       console.log("Adding this: ", songObj);
        //       console.log("Document written with ID: ", docRef.id);
        //       // console.log("With content: ", docRef);
        //       return docRef;
        //     })
        //     .catch(error => {
        //       console.error("Error adding document: ", error);
        //       return error;
        //     });

        //   // promise();
        // });
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
          return (rest.status(420).json = {
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
          return rest.status(418).json({
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
      return fullTime;
    } else {
      let fullTime = {};
      fullTime["timestamp"] = firedate = admin.firestore.Timestamp.fromDate(
        new Date(timestamp * 1000)
      );
      fullTime["weekday"] = weekday = moment(firedate.toDate()).isoWeekday();
      fullTime["week"] = week = moment(firedate.toDate()).isoWeek();
      return fullTime;
    }
  } else {
    let fullTime = {};
    fullTime["timestamp"] = firedate = admin.firestore.Timestamp.fromDate(
      new Date(timestamp)
    );
    fullTime["weekday"] = weekday = moment(firedate.toDate()).isoWeekday();
    fullTime["week"] = week = moment(firedate.toDate()).isoWeek();
    return fullTime;
  }

  //  console.log(date2);
}

/*Function for adding hours, minutes and seconds to a date input, and returning it as UNIX timestamp
@param {string} timestamp - timestamp in format "YYYY-MM-DD" / alternative full format: "YYYY-MM-DDTHH:MM:SS" where SS is optional
@param {string} type - the type of request, set by the calling function
return UNIX timestamp
*/

function unixTimestampHandler(timestamp, type) {
  let time = "";
  if (type === "UNIXBEGINTIME") {
    time = "00:00:00";
  } else if (type === "UNIXENDTIME") {
    time = "23:59:59";
  }

  if (timestamp !== undefined && timestamp.length <= 10) {
    return moment(timestamp + time, "YYYY/MM/DD HH:mm:ss").unix();
  } else {
    return new timestamp();
  }
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

exports.getMusicWeek = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const query = db.collection("statsMusic");
    const getWeekID = req.query.weekID;
    const getUserID = req.query.userID;

    if (getWeekID !== undefined) {
      let result = [];
      let sum = 0;

      let music = query
        .where("weekID", "==", getWeekID)
        .get()
        .then(snapshot => {
          let date = "";
          if (snapshot.emtpy) {
            return res.status(413).json({
              error: "No document for this weekID"
            });
          }
          snapshot.forEach(doc => {
            result.push(doc.data());
            date = doc.get("timestamp").toDate();
            day = doc.get("dayID");

            // date2 = admin.firestore.Timestamp.fromDate(new Date(date *1000));
            weekday = moment(date).isoWeekday();
            week = moment(date).isoWeek();
            //  console.log(date2);
            console.log(weekday);
            console.log(week);
            //let dayum = 1;

            /*      
           do {
            sum += parseInt(doc.get("Valence"));
            console.log("sum er:", sum)
            dayum ++;
           }
            while( counter === day)  
         */
          });
          return null;
        })
        .catch(err => {
          let errmsg = "Error getting documents" + err;
          return res.status(416).json({
            error: errmsg
          });
        });
      return res.status(200).json({
        WeekFound: result
      });
    }
  });
});

exports.tempMusic = functions.https.onRequest((req, res) => {
  const musicObj = req.body;
  console.log(musicObj);
  //      '[{"accountentityid":"19_1148996738","createddate":1551192350631,"id":"1551192350631_4is6Z7ZZkQKxezliMAVah7","entityid":"19_1148996738_1551192350631_4is6Z7ZZkQKxezliMAVah7","track":{"accountentityid":"19_1148996738","album":{"accountentityid":"19_1148996738","artists":[{"accountentityid":"19_1148996738","entityid":"19_1148996738_2WMIMX93pQyfyAF2J2r1ID","id":"2WMIMX93pQyfyAF2J2r1ID","link":"https://open.spotify.com/artist/2WMIMX93pQyfyAF2J2r1ID","name":"Veorra"}],"availablemarkets":["AD","AE","AR","AT","AU","BE","BG","BH","BO","BR","CA","CH","CL","CO","CR","CY","CZ","DE","DK","DO","DZ","EC","EE","EG","ES","FI","FR","GB","GR","GT","HK","HN","HU","ID","IE","IL","IS","IT","JO","JP","KW","LB","LI","LT","LU","LV","MA","MC","MT","MX","MY","NI","NL","NO","NZ","OM","PA","PE","PH","PL","PS","PT","PY","QA","RO","SA","SE","SG","SK","SV","TH","TN","TR","TW","US","UY","VN","ZA"],"entityid":"19_1148996738_6HRMpuoLWFpYL8BO5CqymH","id":"6HRMpuoLWFpYL8BO5CqymH","link":"https://open.spotify.com/album/6HRMpuoLWFpYL8BO5CqymH","name":"Sapphire","releasedate":1440115200000,"resources":[{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":640,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/261e600721ddc40b2f3b84fd629e9df28bb4e967","width":640},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":300,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/3e050a546b1e3c9f52897a18ccf97ca7f8d343ef","width":300},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":64,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/39431f632d04624a69a136daac6263af80cb97b6","width":64}],"type":"album"},"artists":[{"accountentityid":"19_1148996738","entityid":"19_1148996738_2WMIMX93pQyfyAF2J2r1ID","followerscount":61263,"genres":["bass trap","tracestep","traprun"],"id":"2WMIMX93pQyfyAF2J2r1ID","link":"https://open.spotify.com/artist/2WMIMX93pQyfyAF2J2r1ID","name":"Veorra","popularity":55,"resources":[{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":1000,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/66b775bc2361a03832acce4a48b236942b4b210d","width":1000},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":640,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/05067af75d758ee2474a5b2c9ca00c0b218d09c8","width":640},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":200,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/3467b7d8fe3998f34a0e94d511722c99f7601541","width":200},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":64,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/662a56bd962533eaaf1a686dd067bfe737a0b21d","width":64}]}],"availablemarkets":["AD","AE","AR","AT","AU","BE","BG","BH","BO","BR","CA","CH","CL","CO","CR","CY","CZ","DE","DK","DO","DZ","EC","EE","EG","ES","FI","FR","GB","GR","GT","HK","HN","HU","ID","IE","IL","IS","IT","JO","JP","KW","LB","LI","LT","LU","LV","MA","MC","MT","MX","MY","NI","NL","NO","NZ","OM","PA","PE","PH","PL","PS","PT","PY","QA","RO","SA","SE","SG","SK","SV","TH","TN","TR","TW","US","UY","VN","ZA"],"discnumber":1,"duration":233142,"entityid":"19_1148996738_4is6Z7ZZkQKxezliMAVah7","explicit":false,"id":"4is6Z7ZZkQKxezliMAVah7","link":"https://open.spotify.com/track/4is6Z7ZZkQKxezliMAVah7","name":"Standby","number":2,"popularity":52,"resources":[{"duration":30000,"mimetype":"audio/mp3","type":2,"url":"https://p.scdn.co/mp3-preview/5b6dbb36d5243614d9139eb6525f9496bbeee803?cid=8f62e65c31d74c15b9c8129505694ee1"}]}},{"accountentityid":"19_1148996738","createddate":1551192130710,"id":"1551192130710_7b7mtUwxYqTCPsxBvfzbd2","entityid":"19_1148996738_1551192130710_7b7mtUwxYqTCPsxBvfzbd2","track":{"accountentityid":"19_1148996738","album":{"accountentityid":"19_1148996738","artists":[{"accountentityid":"19_1148996738","entityid":"19_1148996738_7w9jdhcgHNdiPeNPUoFSlx","id":"7w9jdhcgHNdiPeNPUoFSlx","link":"https://open.spotify.com/artist/7w9jdhcgHNdiPeNPUoFSlx","name":"Dropkick Murphys"}],"availablemarkets":["AD","AE","AR","AT","AU","BE","BG","BH","BO","BR","CA","CH","CL","CO","CR","CY","CZ","DE","DK","DO","DZ","EC","EE","EG","ES","FI","FR","GB","GR","GT","HK","HN","HU","ID","IE","IL","IS","IT","JO","JP","KW","LB","LI","LT","LU","LV","MA","MC","MT","MX","MY","NI","NL","NO","NZ","OM","PA","PE","PH","PL","PS","PT","PY","QA","RO","SA","SE","SG","SK","SV","TH","TN","TR","TW","US","UY","VN","ZA"],"entityid":"19_1148996738_6jGmS4aaYHvyRhKzACeQij","id":"6jGmS4aaYHvyRhKzACeQij","link":"https://open.spotify.com/album/6jGmS4aaYHvyRhKzACeQij","name":"The Meanest of Times","releasedate":1189987200000,"resources":[{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":640,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/83028d677106bc08a84665796c197b1c606aa"}]}}}]'

  var bodeh = {
    data: [
      '[{"accountentityid":"19_1148996738","createddate":1551192350631,"id":"1551192350631_4is6Z7ZZkQKxezliMAVah7","entityid":"19_1148996738_1551192350631_4is6Z7ZZkQKxezliMAVah7","track":{"accountentityid":"19_1148996738","album":{"accountentityid":"19_1148996738","artists":[{"accountentityid":"19_1148996738","entityid":"19_1148996738_2WMIMX93pQyfyAF2J2r1ID","id":"2WMIMX93pQyfyAF2J2r1ID","link":"https://open.spotify.com/artist/2WMIMX93pQyfyAF2J2r1ID","name":"Veorra"}],"availablemarkets":["AD","AE","AR","AT","AU","BE","BG","BH","BO","BR","CA","CH","CL","CO","CR","CY","CZ","DE","DK","DO","DZ","EC","EE","EG","ES","FI","FR","GB","GR","GT","HK","HN","HU","ID","IE","IL","IS","IT","JO","JP","KW","LB","LI","LT","LU","LV","MA","MC","MT","MX","MY","NI","NL","NO","NZ","OM","PA","PE","PH","PL","PS","PT","PY","QA","RO","SA","SE","SG","SK","SV","TH","TN","TR","TW","US","UY","VN","ZA"],"entityid":"19_1148996738_6HRMpuoLWFpYL8BO5CqymH","id":"6HRMpuoLWFpYL8BO5CqymH","link":"https://open.spotify.com/album/6HRMpuoLWFpYL8BO5CqymH","name":"Sapphire","releasedate":1440115200000,"resources":[{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":640,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/261e600721ddc40b2f3b84fd629e9df28bb4e967","width":640},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":300,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/3e050a546b1e3c9f52897a18ccf97ca7f8d343ef","width":300},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":64,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/39431f632d04624a69a136daac6263af80cb97b6","width":64}],"type":"album"},"artists":[{"accountentityid":"19_1148996738","entityid":"19_1148996738_2WMIMX93pQyfyAF2J2r1ID","followerscount":61263,"genres":["bass trap","tracestep","traprun"],"id":"2WMIMX93pQyfyAF2J2r1ID","link":"https://open.spotify.com/artist/2WMIMX93pQyfyAF2J2r1ID","name":"Veorra","popularity":55,"resources":[{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":1000,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/66b775bc2361a03832acce4a48b236942b4b210d","width":1000},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":640,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/05067af75d758ee2474a5b2c9ca00c0b218d09c8","width":640},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":200,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/3467b7d8fe3998f34a0e94d511722c99f7601541","width":200},{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":64,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/662a56bd962533eaaf1a686dd067bfe737a0b21d","width":64}]}],"availablemarkets":["AD","AE","AR","AT","AU","BE","BG","BH","BO","BR","CA","CH","CL","CO","CR","CY","CZ","DE","DK","DO","DZ","EC","EE","EG","ES","FI","FR","GB","GR","GT","HK","HN","HU","ID","IE","IL","IS","IT","JO","JP","KW","LB","LI","LT","LU","LV","MA","MC","MT","MX","MY","NI","NL","NO","NZ","OM","PA","PE","PH","PL","PS","PT","PY","QA","RO","SA","SE","SG","SK","SV","TH","TN","TR","TW","US","UY","VN","ZA"],"discnumber":1,"duration":233142,"entityid":"19_1148996738_4is6Z7ZZkQKxezliMAVah7","explicit":false,"id":"4is6Z7ZZkQKxezliMAVah7","link":"https://open.spotify.com/track/4is6Z7ZZkQKxezliMAVah7","name":"Standby","number":2,"popularity":52,"resources":[{"duration":30000,"mimetype":"audio/mp3","type":2,"url":"https://p.scdn.co/mp3-preview/5b6dbb36d5243614d9139eb6525f9496bbeee803?cid=8f62e65c31d74c15b9c8129505694ee1"}]}},{"accountentityid":"19_1148996738","createddate":1551192130710,"id":"1551192130710_7b7mtUwxYqTCPsxBvfzbd2","entityid":"19_1148996738_1551192130710_7b7mtUwxYqTCPsxBvfzbd2","track":{"accountentityid":"19_1148996738","album":{"accountentityid":"19_1148996738","artists":[{"accountentityid":"19_1148996738","entityid":"19_1148996738_7w9jdhcgHNdiPeNPUoFSlx","id":"7w9jdhcgHNdiPeNPUoFSlx","link":"https://open.spotify.com/artist/7w9jdhcgHNdiPeNPUoFSlx","name":"Dropkick Murphys"}],"availablemarkets":["AD","AE","AR","AT","AU","BE","BG","BH","BO","BR","CA","CH","CL","CO","CR","CY","CZ","DE","DK","DO","DZ","EC","EE","EG","ES","FI","FR","GB","GR","GT","HK","HN","HU","ID","IE","IL","IS","IT","JO","JP","KW","LB","LI","LT","LU","LV","MA","MC","MT","MX","MY","NI","NL","NO","NZ","OM","PA","PE","PH","PL","PS","PT","PY","QA","RO","SA","SE","SG","SK","SV","TH","TN","TR","TW","US","UY","VN","ZA"],"entityid":"19_1148996738_6jGmS4aaYHvyRhKzACeQij","id":"6jGmS4aaYHvyRhKzACeQij","link":"https://open.spotify.com/album/6jGmS4aaYHvyRhKzACeQij","name":"The Meanest of Times","releasedate":1189987200000,"resources":[{"aspectratio":{"accuracy":100,"actual":"1:1","closest":"1:1"},"height":640,"mimetype":"application/octet-stream","type":0,"url":"https://i.scdn.co/image/83028d677106bc08a84665796c197b1c606aa"}]}}}]'
    ]
  };
  var obj = JSON.parse(bodeh.data);
  console.log(obj[0]);
  console.log(obj);
  cors(req, res, () => {
    let promises = [];
    if (req.method !== "POST") {
      return res.status(420).json({
        message: "Only POST allowed"
      });
    } else {
      var resObj = {};
      for (items in musicObj.items) {
        console.log(musicObj.items[items].track);
        let trackObj = musicObj.items[items].track;
        let dataObj = {};
        const getUser = req.query.userID;
        const getTime = req.query.timestamp;
        let time = timestampHandler(getTime);
        dataObj["userID"] = getUser;
        dataObj["timestamp"] = time.timestamp;
        dataObj["week"] = time.week;
        dataObj["weekday"] = time.weekday;
        Object.assign(dataObj, trackObj);
        let collection = "TempMusic";
        // let setDoc = db.collection(collection).doc(getUser).set(data);
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
      Promise.all(promises).then(() => {
        return res.status(200).json({
          DataAdded: resObj
        });
      });
    }
  });
});
