import { FamilyMember } from '../types/tdb';
import { User } from '../types';

/**
 * FamilyMember를 User 타입으로 변환하는 어댑터 함수
 */
export const familyMemberToUser = (member: any): any => {
  return {
    user_id: member.user_id,
    name: member.name,
    age: member.age || 0,
    birthDate: member.birthDate || '',
    k_uid: member.k_uid || null,
    took_today: member.took_today || 0,
    group_id: member.group_id || '',
    role: member.role || 'child',
    group_name: member.group_name || '',
  };
};

/**
 * User를 FamilyMember 타입으로 변환하는 어댑터 함수
 */
export const userToFamilyMember = (user: any): any => {
  return {
    user_id: user.user_id,
    name: user.name,
    age: user.age || 0,
    birthDate: user.birthDate || '',
    k_uid: user.k_uid || null,
    took_today: user.took_today || 0,
    group_id: user.group_id || '',
    role: user.role || 'child',
    group_name: user.group_name || '',
  };
};

/**
 * FamilyMember 배열을 User 배열로 변환
 */
export const familyMembersToUsers = (members: FamilyMember[]): User[] => {
  return members.map(familyMemberToUser);
};

/**
 * User 배열을 FamilyMember 배열로 변환
 */
export const usersToFamilyMembers = (users: User[]): FamilyMember[] => {
  return users.map(userToFamilyMember);
}; 