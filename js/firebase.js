// Conexão com o Firebase (banco Firestore + login).
// A versão da biblioteca fica nas URLs abaixo; para atualizar, troque o número nas 3 linhas.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, serverTimestamp,
  query, where, onSnapshot, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js?v=20261109a';

export const configurado = !String(firebaseConfig.apiKey || '').startsWith('COLE');

export const app = configurado ? initializeApp(firebaseConfig) : null;

// Cache local: se o Wi-Fi cair por alguns instantes, o envio fica guardado
// no aparelho e é concluído sozinho quando a conexão voltar.
export const db = configurado
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null;
export const auth = configurado ? getAuth(app) : null;

export {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, serverTimestamp,
  query, where, onSnapshot, Timestamp,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};
