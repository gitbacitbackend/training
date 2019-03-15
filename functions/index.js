//https://us-central1-mmfapp-3603c.cloudfunctions.net/addMessage?text=
// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

var db = admin.firestore();

// Take the text parameter passed to this HTTP endpoint and insert it into the
// Realtime Database under the path /messages/:pushId/original
exports.addMessage = functions.https.onRequest((req, res) => {
    // Grab the text parameter.
    const original = req.query.text;
    // Push the new message into the Realtime Database using the Firebase Admin SDK.
    return admin.database().ref('/messages').push({original: original}).then((snapshot) => {
      // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
      return res.redirect(303, snapshot.ref.toString());
    });
  });
  
// Listens for new messages added to /messages/:pushId/original and creates an
// uppercase version of the message to /messages/:pushId/uppercase
exports.makeUppercase = functions.database.ref('/messages/{pushId}/original')
    .onCreate((snapshot, context) => {
      // Grab the current value of what was written to the Realtime Database.
      const original = snapshot.val();
      console.log('Uppercasing', context.params.pushId, original);
      const uppercase = original.toUpperCase();
      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to the Firebase Realtime Database.
      // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
      return snapshot.ref.parent.child('uppercase').set(uppercase);
    });

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
exports.jsonMessage = functions.https.onRequest((req, res) => {
    // cors wrapper for cross platform(app) access
    cors(req, res,() => {
      const original = req.query.text;
      //console.log('Uppercasing', context.params.pushId, original);
      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to the Firebase Realtime Database.
      // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
          res.status(200).json({
        sampleTime: '1450632410296',
        data: '76.36731:3.4651554:0.5665419',
        text: original
      });
    });

      //return data;
  });

  exports.registerMood = functions.https.onRequest((req, res) => {
    const getMood = req.query.mood;
    const getUser = req.query.user;
    const getComment = req.body;
    // cors wrapper for cross platform(app) access
    cors(req, res,() => {
      if (req.method !== "POST") {
          return res.status(420).json({
              message: "Only POST allowed"
          });
      }
      
      let data = {
        user: getUser,
        mood: getMood
      };
      
      let collection = "torCollection"
      let setDoc = db.collection(collection).doc(getUser).set(data);

      const query  = db.collection(collection).where('user', '=', getUser);

      let result;
        query.onSnapshot(products => {

          products.forEach(doc => {
              result = doc.data();
          })

        });

      //console.log('Uppercasing', context.params.pushId, original);
      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to the Firebase Realtime Database.
      // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
          return res.status(200).json({
        toCollection: collection,
        toUser: getUser,
        toMood: getMood,
        queryRes: result,
        comment: getComment
        
      });
    });
  });
  exports.getMusic = functions.https.onRequest((req, res) => {
    cors(req, res,() => {

      const getUser = req.query.userID;
      const getMood = req.query.mood;
      const getType = req.query.type;

      const query  = db.collection("Music")

      // Getter for specific mood by user
      if(getUser !== undefined && getMood !== undefined) {
        let result = [];
        let users = query.where('userID', '==', getUser).where('mood', '==', getMood).get().then(snapshot => {
          if (snapshot.empty) {
            return res.status(418).json({
              error: 'No matching documents.'
            })
          }
            snapshot.forEach(doc => {
              console.log(doc.id, '=>', doc.data());
              result.push(doc.data());
            });
            return res.status(200).json({
              restRes: result
            })
          })
          .catch(err => {
            let errmsg = 'Error getting documents' + err;
            return rest.status(420).json=({
              error: errmsg
            })
          });
      }
      if(getUser !== undefined && getMood === undefined) {
        let result = [];
        
        let users = query.where('userID', '==', getUser).get().then(snapshot => {
          if (snapshot.empty) {
            return res.status(418).json({
              error: 'No matching documents.'
            })
          }
            snapshot.forEach(doc => {
              console.log(doc.id, '=>', doc.data());
              result.push(doc.data());
            });
            return res.status(200).json({
              restRes: result
            })
          })
          .catch(err => {
            let errmsg = 'Error getting documents' + err;
            return rest.status(420).json=({
              error: errmsg
            })
          });
      }
      
    

        // return res.status(200).json({
        //   searchFor: getUser,
        //   queryRes: result

        // });
    });
  });