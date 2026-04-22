window.firebaseConfig = {
  apiKey: "AIzaSyCna2awece-Xe7d_l0IeJ97cGXrnxZE0es",
  authDomain: "genzearn-a0313.firebaseapp.com",
  databaseURL: "https://genzearn-a0313-default-rtdb.firebaseio.com",
  projectId: "genzearn-a0313",
  storageBucket: "genzearn-a0313.firebasestorage.app",
  messagingSenderId: "514449582943",
  appId: "1:514449582943:web:58dea5dcf7d88263db64ea",
  measurementId: "G-TD6NPH9PVE"
};

var firebaseConfig = window.firebaseConfig;

if (
  window.firebase &&
  typeof window.firebase.initializeApp === 'function' &&
  (!window.firebase.apps || window.firebase.apps.length === 0)
) {
  firebase.initializeApp(firebaseConfig);
}
