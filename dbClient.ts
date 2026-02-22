import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import { Moment, GardenState } from './types';

const firebaseConfig = {
  databaseURL: "https://garden-ee498-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const dbClient = {
  saveMoments: async (moments: Moment[]) => {
    try {
      await set(ref(db, 'moments'), moments);
    } catch (e) {
      console.error("Firebase saveMoments failed:", e);
      localStorage.setItem('cloud_moments', JSON.stringify(moments));
    }
  },
  
  saveGarden: async (garden: GardenState) => {
    try {
      await set(ref(db, 'garden'), garden);
    } catch (e) {
      console.error("Firebase saveGarden failed:", e);
      localStorage.setItem('cloud_garden', JSON.stringify(garden));
    }
  },
  
  setupSync: (onMoments: (m: Moment[]) => void, onGarden: (g: GardenState) => void) => {
    const momentsRef = ref(db, 'moments');
    const gardenRef = ref(db, 'garden');

    const unsubscribeMoments = onValue(momentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        onMoments(data);
      } else {
        const local = localStorage.getItem('cloud_moments');
        if (local) onMoments(JSON.parse(local));
      }
    });

    const unsubscribeGarden = onValue(gardenRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        onGarden(data);
      } else {
        const local = localStorage.getItem('cloud_garden');
        if (local) {
          onGarden(JSON.parse(local));
        } else {
          onGarden({ roses: [], streak: 0, lastCollectionDate: null });
        }
      }
    });

    return () => {
      unsubscribeMoments();
      unsubscribeGarden();
    };
  }
};
