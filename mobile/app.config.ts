import type { ConfigContext, ExpoConfig } from "expo/config";

// Google client IDs and URL schemes come from the environment (.env), never from the repository.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Mis Gastos",
  slug: "myexpenses",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "myexpenses",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: "com.myexpenses.app",
  },
  android: {
    package: "com.myexpenses.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? "com.googleusercontent.apps.placeholder",
      },
    ],
    "expo-secure-store",
    "expo-localization",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
