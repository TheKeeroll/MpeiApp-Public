/**
 * The Firebase auth bridge is retained for a future reintroduction, but the
 * native Firebase packages are intentionally not linked in the current app.
 * Keep this declaration in sync with firebase.ts until that integration is
 * restored with the official SDK.
 */
declare module '@react-native-firebase/auth' {
  export namespace FirebaseAuthTypes {
    interface User {
      readonly uid: string;
    }

    interface UserCredential {
      readonly user: User;
    }
  }

  interface FirebaseAuthModule {
    createUserWithEmailAndPassword(
      email: string,
      password: string,
    ): Promise<FirebaseAuthTypes.UserCredential>;
    signInWithEmailAndPassword(
      email: string,
      password: string,
    ): Promise<FirebaseAuthTypes.UserCredential>;
  }

  const auth: () => FirebaseAuthModule;
  export default auth;
}
