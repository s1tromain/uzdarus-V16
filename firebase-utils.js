// Firebase Configuration and Utilities
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, getDoc, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB_0gyDPwaZpMIzhP7ukpi-KTWPPAlhfTs",
    authDomain: "uzdarus-b97aa.firebaseapp.com",
    projectId: "uzdarus-b97aa",
    storageBucket: "uzdarus-b97aa.firebasestorage.app",
    messagingSenderId: "356182863532",
    appId: "1:356182863532:web:326d8e09465d86f0077909",
    measurementId: "G-MG220RDLRP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export Firebase utilities
export const firebaseDB = db;
export const firestoreModules = {
    collection,
    addDoc,
    getDocs,
    getDoc,
    query,
    where,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    orderBy
};

// Utility functions
export async function getAllUsers() {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

export async function getUserByEmail(email) {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return {
            id: querySnapshot.docs[0].id,
            ...querySnapshot.docs[0].data()
        };
    }
    return null;
}

export async function addUser(userData) {
    const docRef = await addDoc(collection(db, 'users'), {
        ...userData,
        registeredAt: serverTimestamp()
    });
    return docRef.id;
}

export async function updateUser(userId, updates) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updates);
}

export async function deleteUser(userId) {
    await deleteDoc(doc(db, 'users', userId));
}

export async function logActivity(userEmail, action, type = 'general') {
    try {
        await addDoc(collection(db, 'activityLogs'), {
            userEmail: userEmail,
            action: action,
            type: type,
            timestamp: serverTimestamp(),
            ip: 'Local',
            userAgent: navigator.userAgent
        });
        console.log('✅ Activity logged:', action);
    } catch (error) {
        console.error('❌ Error logging activity:', error);
    }
}

export async function getAllActivityLogs() {
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
    }));
}

export async function getUserActivityLogs(email) {
    const q = query(
        collection(db, 'activityLogs'),
        where('userEmail', '==', email),
        orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
    }));
}

// Realtime listeners
export function listenToUsers(callback) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(users);
    });
}

export function listenToActivityLogs(callback) {
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
        }));
        callback(logs);
    });
}

// ==================== QUIZ RESULTS FUNCTIONS ====================

// Сохранение результата теста
export async function saveQuizResult(userId, topicId, quizData, course = 'A1') {
    try {
        const resultRef = doc(db, 'users', userId, 'quizResults', `topic_${topicId}`);
        await setDoc(resultRef, {
            ...quizData,
            course: course, // Добавляем курс
            updatedAt: serverTimestamp()
        });
        console.log('✅ Quiz result saved for topic:', topicId, 'course:', course);
        return true;
    } catch (error) {
        console.error('❌ Error saving quiz result:', error);
        return false;
    }
}

// Получение всех результатов тестов пользователя
export async function getUserQuizResults(userId, course) {
    try {
        const resultsRef = collection(db, 'users', userId, 'quizResults');
        const querySnapshot = await getDocs(resultsRef);
        const results = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Если курс указан, фильтруем результаты по курсу
            if (!course || data.course === course) {
                results[doc.id] = data;
            }
        });
        return results;
    } catch (error) {
        console.error('❌ Error getting quiz results:', error);
        return {};
    }
}

// Получение результата конкретной темы
export async function getTopicQuizResult(userId, topicId) {
    try {
        const resultRef = doc(db, 'users', userId, 'quizResults', `topic_${topicId}`);
        const resultDoc = await getDoc(resultRef);
        if (resultDoc.exists()) {
            return resultDoc.data();
        }
        return null;
    } catch (error) {
        console.error('❌ Error getting topic quiz result:', error);
        return null;
    }
}

// Сохранение прогресса пользователя
export async function saveUserProgress(userId, course, progressData) {
    try {
        const userRef = doc(db, 'users', userId);
        
        // Если передан только course как второй аргумент и это массив, значит старый формат
        if (Array.isArray(course)) {
            console.warn('⚠️ DEPRECATED: Using old saveUserProgress format, please update to (userId, course, progressData)');
            await updateDoc(userRef, {
                completedTopics: course,
                lastActivity: serverTimestamp()
            });
        } else {
            // Новый формат с курсом
            const updateData = {
                [`courses.${course}`]: progressData,
                lastActivity: serverTimestamp()
            };
            await updateDoc(userRef, updateData);
        }
        
        console.log('✅ User progress saved for course:', course);
        return true;
    } catch (error) {
        console.error('❌ Error saving user progress:', error);
        return false;
    }
}

// Получение прогресса пользователя
export async function getUserProgress(userId, course) {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Если курс указан, возвращаем данные для этого курса
            if (course) {
                return data.courses?.[course] || null;
            }
            
            // Иначе возвращаем старый формат для обратной совместимости
            return data.completedTopics || [];
        }
        return course ? null : [];
    } catch (error) {
        console.error('❌ Error getting user progress:', error);
        return course ? null : [];
    }
}
