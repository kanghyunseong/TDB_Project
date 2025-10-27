import axios from 'axios';

// 통합된 API URL 사용 (EC2 서버)
import { API_URL } from '../constants/api';
const API_BASE_URL = API_URL;

// 가족 구성원 조회
export const getFamilyMembers = async (connect: string) => {
  try {
    console.log(`[API] 가족 구성원 조회: ${connect}`);
    const response = await axios.get(`${API_BASE_URL}/api/family/members-by-connect/${connect}`);
    console.log('[API] 가족 구성원 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] 가족 구성원 조회 실패:', error);
    throw error;
  }
};

// 기본 가족 통계 조회
export const getFamilyStats = async (connect: string) => {
  try {
    console.log(`[API] 기본 가족 통계 조회: ${connect}`);
    const response = await axios.get(`${API_BASE_URL}/api/dose-history/family-stats/${connect}`);
    console.log('[API] 기본 가족 통계 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] 기본 가족 통계 조회 실패:', error);
    throw error;
  }
};

// 🔥 새로운 상세 가족 통계 조회
export const getDetailedFamilyStats = async (connect: string) => {
  try {
    console.log(`[API] 상세 가족 통계 조회: ${connect}`);
    const response = await axios.get(`${API_BASE_URL}/api/dose-history/family-detailed-stats/${connect}`);
    console.log('[API] 상세 가족 통계 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] 상세 가족 통계 조회 실패:', error);
    throw error;
  }
};

// 개별 사용자 오늘 진행률 조회
export const getTodayProgress = async (userId: string) => {
  try {
    console.log(`[API] 개별 사용자 진행률 조회: ${userId}`);
    const response = await axios.get(`${API_BASE_URL}/api/dose-history/today-progress/${userId}`);
    console.log('[API] 개별 사용자 진행률 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] 개별 사용자 진행률 조회 실패:', error);
    throw error;
  }
};

// 🔥 새로운 가족 기기 상태 조회
export const getFamilyMachineStatus = async (connect: string) => {
  try {
    console.log(`[API] 가족 기기 상태 조회: ${connect}`);
    const response = await axios.get(`${API_BASE_URL}/api/machine/family-status/${connect}`);
    console.log('[API] 가족 기기 상태 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] 가족 기기 상태 조회 실패:', error);
    throw error;
  }
}; 