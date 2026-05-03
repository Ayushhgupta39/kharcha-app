import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'Kharcha (Dev)' : 'Kharcha',
  slug: 'kharcha-app',
  scheme: IS_DEV ? 'kharcha-dev' : 'kharcha',
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.kharcha.app.dev' : 'com.kharcha.app',
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.kharcha.app.dev' : 'com.kharcha.app',
  },
});
