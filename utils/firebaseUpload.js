const { getStorage, ref ,getDownloadURL, uploadBytesResumable } = require('firebase/storage')
const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require("firebase/auth");
const { auth } = require('../config/firebase.config')


async function uploadImage(files, quantity) {
    const storageFB = getStorage();

    await signInWithEmailAndPassword(auth, process.env.FIREBASE_USER, process.env.FIREBASE_AUTH);

    if (quantity === 'single') {
        // Handle single file upload logic
        const file = files
        // const file = files[0]; // Assuming only one file is expected for single upload
        const dateTime = Date.now();
        const fileName = `images/${dateTime}`;
        const storageRef = ref(storageFB, fileName);
        
        const metadata = {
            contentType: file.type,
        };

        // Upload the file in the bucket storage
        const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata);

        // Grab the public url
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    }

    if (quantity === 'multiple') {
        // Handle multiple file upload logic
        const downloadURLs = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const dateTime = Date.now();
            const fileName = `images/${dateTime}_${i}`; // Appending index to ensure unique file names
            const storageRef = ref(storageFB, fileName);
            const metadata = {
                contentType: file.type,
            };

            // Upload the file in the bucket storage
            const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata);

            // Grab the public url
            const downloadURL = await getDownloadURL(snapshot.ref);
            downloadURLs.push(downloadURL);
        }
        return downloadURLs;
    }
}


module.exports = {uploadImage};

