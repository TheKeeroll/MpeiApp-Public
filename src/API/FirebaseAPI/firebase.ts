import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth'
import User = FirebaseAuthTypes.User;
import UserCredential = FirebaseAuthTypes.UserCredential;

export interface FireBaseAuthCredentials {
    mailbox: string
    password: string
}



export default class FireBaseAPI{
    private mCredentials: FireBaseAuthCredentials
    private mUserInstance: UserCredential | null = null
    private mLoggedIn: boolean = false


    public constructor(creds: FireBaseAuthCredentials) {
        this.mCredentials = creds
    }

    public SignUp(): Promise<void> {
        return auth().createUserWithEmailAndPassword(this.mCredentials.mailbox, this.mCredentials.password)
            .then((user)=>{
                this.mLoggedIn = true
                this.mUserInstance = user
                return Promise.resolve()
            })
    }

    public LogIn(): Promise<void> {
        return auth().signInWithEmailAndPassword(this.mCredentials.mailbox, this.mCredentials.password)
            .then((user)=>{
                this.mLoggedIn = true
                this.mUserInstance = user
                return Promise.resolve()
            })
    }
}