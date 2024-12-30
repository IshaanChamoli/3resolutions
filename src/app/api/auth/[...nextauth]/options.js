import GoogleProvider from "next-auth/providers/google"
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

export const options = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("SignIn callback triggered", { user, account });
      
      if (account.provider === "google") {
        try {
          console.log("Attempting to access Firestore...");
          const userRef = doc(db, "users", user.email);
          console.log("Got user ref:", userRef.path);
          
          const userSnap = await getDoc(userRef);
          console.log("User exists?", userSnap.exists());
          
          if (!userSnap.exists()) {
            const userData = {
              email: user.email,
              name: user.name,
              image: user.image,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              provider: account.provider,
              providerId: account.providerAccountId,
              imageCount: 0,
              lockedIn: true
            };
            console.log("Creating new user with data:", userData);
            await setDoc(userRef, userData);
            console.log('New user created in Firestore:', user.email);
          } else {
            const updateData = {
              lastLogin: serverTimestamp(),
              name: user.name,
              image: user.image
            };
            console.log("Updating existing user with data:", updateData);
            await setDoc(userRef, updateData, { merge: true });
            console.log('Existing user updated in Firestore:', user.email);
          }
          return true;
        } catch (error) {
          console.error("Error handling Firebase user:", error);
          console.error("Full error object:", JSON.stringify(error, null, 2));
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      console.log("Session callback triggered", { session });
      if (session?.user?.email) {
        try {
          const userDoc = await getDoc(doc(db, "users", session.user.email));
          if (userDoc.exists()) {
            session.user.userData = userDoc.data();
            console.log("Added user data to session:", session.user.userData);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
      return session;
    }
  },
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/"
  }
} 