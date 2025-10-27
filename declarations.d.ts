// src/declarations.d.ts 또는 프로젝트 루트에
declare module '*.json' {
    const value: any;
    export default value;
  }

// react-native-dotenv 타입 정의
declare module '@env' {
  export const API_URL: string;
}