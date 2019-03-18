//https://us-central1-mmfapp-3603c.cloudfunctions.net/addMessage?text=
// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');
const os = require("os");
const path = require("path");
const cors = require('cors')({ origin: true });
const Busboy = require('busboy');
const fs = require("fs");

const projectId = "mmfapp-3603c";
const keyFilename = "mmfapp-3603c-firebase-adminsdk-svbs5-766e253d58.json";

//Imports the Google Cloud client library
const {Storage} = require("@google-cloud/storage");

const gcs = new Storage ({
  projectId: projectId,
  keyFilename: keyFilename
});


// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

exports.uploadFile = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== 'POST') {
      return res.status(500).json({
        message: "Not allowed"
      });
    }
    const busboy = new Busboy({ headers: req.headers });
    let uploadData = null;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const filepath = path.join(os.tmpdir(), filename);
      uploadData = { file: filepath, type: mimetype };
      file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on("finish", () => {
      const bucket = gcs.bucket("mmfapp-3603c.appspot.com");
      bucket.upload(uploadData.file, {
        uploadType: "media",
        metadata: {
          metadata: {
            contentType: uploadData.type
          }
        }
      })
        .then(() => {
         return res.status(200).json({
            message: "Euraka!"
          });
        })
        .catch(err => {
         return res.status(500).json({
            error: err
          });
        });
    });
    busboy.end(req.rawBody);
  });
});