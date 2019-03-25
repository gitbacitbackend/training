//https://us-central1-mmfapp-3603c.cloudfunctions.net/addMessage?text=
// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const moment = require("moment");

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

var db = admin.firestore();

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
  .document("Mood/{userID}")
  .onCreate((snap, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    let newValue = snap.data();

    // access a particular field as you would any JS property
    let userID = newValue.userID;
    let spotifyID = "";
    let query = db.collection("users").doc(userID);

    var getDoc = query
      .get()
      .then(doc => {
        if (!doc.exists) {
          console.log("No such document!");
          return false;
        } else {
          console.log("Document data:", doc.data());
          spotifyID = doc.get("spotifyID");
          console.log("Resulting id: " + spotifyID);
          return doc.data();
        }
      }) // TODO: Spotify/Digime call here
      .catch(err => {
        console.log("Error getting document", err);
      });

    // [END basic_wildcard]
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
  let beginTime = admin.firestore.Timestamp.fromDate(
    timestampHandler(date, "BEGINTIME")
  );
  let endTime = admin.firestore.Timestamp.fromDate(
    timestampHandler(date, "ENDTIME")
  );
  console.log("timeStamp: " + beginTime.toDate());

  let resTime = "";
  let collection = "Mood";
  // var addTime = db
  //   .collection(collection)
  //   .doc("timetest1")
  //   .set({ timestamp: firetime });

  let newRes = db
    .collection(collection)
    .where("timestamp", ">", beginTime)
    .where("timestamp", "<", endTime)
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
@param {string} timestamp - timestamp in format "YYYY-MM-DD" / alternative full format: "YYYY-MM-DDTHH:MM:SS" where SS is optional
@param {string} type - the type of request, set by the calling function
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

  if (timestamp !== undefined && timestamp.length <= 10) {
    return new Date(timestamp + time);
  } else {
    return new Date(timestamp);
  }
}

/*Function for adding hours, minutes and seconds to a date input, and returning it as UNIX timestamp
@param {string} timestamp - timestamp in format "YYYY-MM-DD" / alternative full format: "YYYY-MM-DDTHH:MM:SS" where SS is optional
@param {string} type - the type of request, set by the calling function
return UNIX timestamp
*/

function unixTimestampHandler(timestamp, type){
  let time = "";
  if(type === "UNIXBEGINTIME") {
    time = "00:00:00";
  }
  else if (type === "UNIXENDTIME"){
    time = "23:59:59";
  }

  if (timestamp !== undefined && timestamp.length <=10) {
    return (moment(timestamp + time, "YYYY/MM/DD HH:mm:ss").unix());
  } else {
    return new (timestamp);
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

    let unixStart = unixTimestampHandler(getDateFromUser, "UNIXBEGINTIME");
    let unixEnd = unixTimestampHandler(getDateFromUser, "UNIXENDTIME");

    if (getUser !== undefined) {
      let result = [];
      let users = query
      .where("UserID", "==", getUser)
      .where("DateListened", ">", unixStart)
      .where("DateListened", "<", unixEnd)
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