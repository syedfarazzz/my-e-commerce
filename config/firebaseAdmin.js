var admin = require("firebase-admin");

var serviceAccount = require("./e-commerce-5bdf9-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = { admin }