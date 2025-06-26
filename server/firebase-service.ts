
import admin from 'firebase-admin';
import { log } from './vite';

// Firebase service account configuration
const serviceAccount = {
  type: "service_account",
  project_id: "notification-social-network",
  private_key_id: "3490bbc33d8b9f631f08193e43318a9a9087e8ad",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDlbLB0kP8WqjnD\nl4SZcP+p+TxMMN7GTRsgZZI4u8+446YOa30ZOUSHqx3c3g/+rjrSca6e6GtXooAB\nUSrYeEhFKfBPvB83Zlg+psHTyl4qcovdHN6L9oy7mSGrtw8XVIpJtyEyuGkHM7M0\ne+pArQtrOCkcf/xEiwqU+qU116wQoK1uPHmKCiUnivI6TeipOeE1LD0FtOdfMaKf\ne3b9O5VteaiWLbO9HKBZeyeaA7yRR4LP9xGfD0yOAWAGg/IX4tzP8wDtwAN1E4mU\niJ4turDVRBqanqeEDIgSwKO/tFPyAZU8MNFMnZdPAPs+dvmCAsmgv5SgscRzAZw9\nuw9wW/69AgMBAAECggEAFegLrkm1DcM5ykcSunsLcn2xp/3Hm8w7gZupO2EVi8wy\n7DAPzSOGe2TXsGIEyXb192ey+onrS/4gdl+7dVmA3xfK0jY+jdHoLa1LFy+8z5VJ\n7RZHWrpzRCtyR1zupDXmkXTaxubMYotpemK1orDTRQzjAg1nd10GaOTI9yvtilW7\nBuCgX7xC2pfqu9LLpMIVGPRrjwLIOOnX/h2lw1Igzx0qATyHvTbh9+lNi11bNINs\nRAaBqr9IjxkC8kqR0mWBlceO0zYrRZOKVgnrjhWSxD5lbfvwIWkejAuMkEeo3Xoh\nmf/LnWhEGZT0p0mHeG/X3V6pf/cU/Yrm3ctFpH9iKQKBgQD3lIADV/xW1ejgZXUJ\ngoTsrQibNkyTy3LIZSzffBpUwebsHEjVhP1jOZwD8HoRwMiIgj2g9W9BaK0+IbiI\nJmPzbQ+vKh6I+5UfJkryZe2P+jmnmd3eieHdQmwUOn2IeU/mYbeQuKyiic9UCkBx\nbweGEpQi3tLfCBpofKefhj9pGQKBgQDtOh9UQbd2mErzQIzC5rHvDwQuuZljOibJ\nSwCiSQmaDAxvvAMfF2EgOwOZ/EfkezxgUr69fXSV2oNPKF2mTm2eNsrKPb7FJ5dF\njtMrjNiEd4r1Z/j6v+GVpZDjGuG30bZ59m3atzr4j4TKpvIhhBfRAspsUkbuJYkf\n8jPJ7KBjRQKBgQCggPZItKbTyNOzfjLU2nfAVCErNpWIjzG3ttfTfso3PomtclzJ\nh/EZfcSmTSVmEvwue3jmu5bH6cu+ZvAR3AmaS48KeRzYo3k2e4XFBc1wNMFh5X+Q\nAQWbgq88ofq2GidxbNIrkX3h1cPCcO78WwWeprbAsII2szMjoASvh8HeKQKBgH/4\n7NGtKeVmPnh/B/BUNwS5Ww5BvUdUJXxNY6goMm/RtBvKlvx8xj5213iIKdhNysJD\noPXj6bK1UESxh+OhR20kLb1wFauRsf8qDyzdLCg5vNKqJhxOysjJqiF5bO6WyRN+\nJsDoO32/HmmcKd5+vcJY+Q36TJ1HznNXWyzA47zpAoGBAIID/s88pUfEshSdM84Z\nU39jXTnKouf44eCd/O/zcmo64Mnny3j9wZrlUxYXGmv/Mryq+833/BFaA87xNmTw\n2MFW5jf3KLenD9FNN9vqEgPuyTqiwAbhQTvstcKDTwoxQdTb0VHBuhcqeIHLDIGP\nTKncdZ1HYKcPMppcQKKhbguQ\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-yvc6w@notification-social-network.iam.gserviceaccount.com",
  client_id: "111278635302398331778",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-yvc6w%40notification-social-network.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

class FirebaseService {
  private static instance: FirebaseService;
  private initialized = false;

  private constructor() {
    this.initializeFirebase();
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  private initializeFirebase() {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
          projectId: serviceAccount.project_id
        });
        this.initialized = true;
        log('🔥 Firebase Admin SDK initialized successfully', 'firebase');
      }
    } catch (error) {
      log(`❌ Failed to initialize Firebase: ${error}`, 'firebase-error');
      throw error;
    }
  }

  public async sendPushNotification(deviceToken: string, title: string, body: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const message = {
        notification: {
          title,
          body
        },
        token: deviceToken,
        android: {
          notification: {
            icon: 'stock_ticker_update',
            color: '#7e55c3'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      log(`✅ Push notification sent successfully: ${response}`, 'firebase');
      return response;
    } catch (error) {
      log(`❌ Failed to send push notification: ${error}`, 'firebase-error');
      throw error;
    }
  }

  public async sendMulticastNotification(deviceTokens: string[], title: string, body: string): Promise<admin.messaging.BatchResponse> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const message = {
        notification: {
          title,
          body
        },
        tokens: deviceTokens,
        android: {
          notification: {
            icon: 'stock_ticker_update',
            color: '#7e55c3'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().sendMulticast(message);
      log(`✅ Multicast notification sent: ${response.successCount}/${deviceTokens.length} successful`, 'firebase');
      return response;
    } catch (error) {
      log(`❌ Failed to send multicast notification: ${error}`, 'firebase-error');
      throw error;
    }
  }

  public async validateToken(deviceToken: string): Promise<boolean> {
    try {
      // Send a dry run message to validate the token
      await admin.messaging().send({
        token: deviceToken,
        notification: {
          title: 'Test',
          body: 'Test'
        }
      }, true); // dry run = true
      return true;
    } catch (error) {
      log(`❌ Invalid device token: ${error}`, 'firebase-error');
      return false;
    }
  }
}

export const firebaseService = FirebaseService.getInstance();
