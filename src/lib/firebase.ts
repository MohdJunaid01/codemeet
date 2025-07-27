
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    "projectId": "codemeet-4tokj",
    "appId": "1:565853298532:web:d7707c64f7b3580824e471",
    "storageBucket": "codemeet-4tokj.firebasestorage.app",
    "apiKey": "AIzaSyC66NP6EFbiyWrd2nR-Ovs3XZ2drUML8Cs",
    "authDomain": "codemeet-4tokj.firebaseapp.com",
    "measurementId": "",
    "messagingSenderId": "565853298532"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
