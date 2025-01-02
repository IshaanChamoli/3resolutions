import GoogleProvider from "next-auth/providers/google"
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { formatNameForUrl } from '@/app/utils/nameUtils';

export const options = {
  providers: [
    {
      id: 'email-login',
      name: 'Email',
      type: 'credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        name: { label: "Name", type: "text" }
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.name) return null;
        
        try {
          const userRef = doc(db, "users", credentials.email);
          const userSnap = await getDoc(userRef);
          
          const userData = {
            email: credentials.email,
            name: credentials.name,
            formattedName: formatNameForUrl(credentials.name),
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              ...userData,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              imageCount: 0,
              lockedIn: true,
              hasSharedToLinkedIn: false
            });
          } else {
            await setDoc(userRef, {
              lastLogin: serverTimestamp(),
              name: credentials.name,
              formattedName: formatNameForUrl(credentials.name)
            }, { merge: true });
          }

          return {
            id: credentials.email,
            email: credentials.email,
            name: credentials.name
          };
        } catch (error) {
          console.error("Error in email auth:", error);
          return null;
        }
      }
    }
  ],
  callbacks: {
    async session({ session }) {
      if (session?.user?.email) {
        try {
          const userDoc = await getDoc(doc(db, "users", session.user.email));
          if (userDoc.exists()) {
            session.user.userData = userDoc.data();
          }
        } catch (error) {
          console.error("Error fetching user data for session:", error);
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/',
  }
}; 