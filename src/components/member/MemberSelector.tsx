import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../../constants/colors';
import { FamilyMember } from '../../types/tdb';

interface MemberSelectorProps {
  userType: 'parent' | 'child' | null;
  selectedMember: FamilyMember | null;
  familyMembers: FamilyMember[];
  isExpanded: boolean;
  isDark: boolean;
  themeColors: any;
  onToggleExpand: () => void;
  onSelectMember: (member: FamilyMember) => void;
}

/**
 * 가족 구성원 선택 컴포넌트
 * - 보호자 계정: 확장 가능한 구성원 선택 UI
 * - 자녀 계정: 고정된 헤더만 표시
 */
const MemberSelector: React.FC<MemberSelectorProps> = React.memo(({
  userType,
  selectedMember,
  familyMembers,
  isExpanded,
  isDark,
  themeColors,
  onToggleExpand,
  onSelectMember,
}) => {
  // 보호자 계정: 확장 가능한 선택 UI
  if (userType === 'parent' && selectedMember) {
    return (
      <>
        <TouchableOpacity 
          style={[
            styles.userSelectionCard, 
            { 
              backgroundColor: isDark ? themeColors.card : 'white',
              borderColor: colors.PRIMARY.DEFAULT,
            }
          ]}
          onPress={onToggleExpand}
        >
          <View style={styles.userCardContent}>
            <View style={styles.userMainInfo}>
              <View style={[styles.userAvatar, { 
                backgroundColor: selectedMember.role === 'parent' ? colors.PRIMARY.DEFAULT : colors.SUCCESS.DEFAULT 
              }]}>
                <Text style={styles.userAvatarText}>
                  {selectedMember.role === 'parent' ? 'M' : 'S'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: themeColors.text }]}>
                  {selectedMember.name}
                </Text>
                <Text style={[styles.userSubtitle, { color: isDark ? '#888' : '#666' }]}>
                  {selectedMember.age}세 • {selectedMember.role === 'parent' ? '보호자 계정' : '자녀 계정'}
                </Text>
              </View>
            </View>
            <View style={styles.expandIndicator}>
              <View style={[styles.expandButton, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}>
                <Feather 
                  name="chevron-down" 
                  size={18} 
                  color={isDark ? '#ccc' : '#666'} 
                  style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 가족 구성원 목록 */}
        {isExpanded && (
          <View style={[
            styles.memberListContainer,
            { 
              backgroundColor: isDark ? themeColors.card : 'white',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#e0e0e0',
              shadowColor: isDark ? '#000' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              paddingVertical: 8,
            }
          ]}>
            {familyMembers.map((member) => (
              <TouchableOpacity
                key={member.user_id}
                style={[
                  styles.memberCard,
                  { 
                    backgroundColor: 'transparent',
                    borderColor: selectedMember.user_id === member.user_id ? 
                      colors.PRIMARY.DEFAULT : 'transparent',
                    borderWidth: selectedMember.user_id === member.user_id ? 2 : 0,
                    borderRadius: selectedMember.user_id === member.user_id ? 8 : 0,
                    marginHorizontal: 8,
                    marginVertical: 4,
                  }
                ]}
                onPress={() => onSelectMember(member)}
              >
                <View style={styles.memberCardContent}>
                  <View style={styles.memberMainInfo}>
                    <View style={[styles.memberAvatar, { 
                      backgroundColor: member.role === 'parent' ? colors.PRIMARY.DEFAULT : colors.SUCCESS.DEFAULT
                    }]}>
                      <Text style={styles.memberAvatarText}>
                        {member.role === 'parent' ? 'M' : 'S'}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: themeColors.text }]}>
                        {member.name}
                      </Text>
                      <Text style={[styles.memberSubtitle, { 
                        color: isDark ? '#888' : '#666'
                      }]}>
                        {member.age}세 • {member.role === 'parent' ? '보호자 계정' : '자녀 계정'}
                      </Text>
                    </View>
                  </View>
                  {selectedMember.user_id === member.user_id && (
                    <View style={styles.selectedIndicator}>
                      <View style={[styles.checkmark, { backgroundColor: colors.PRIMARY.DEFAULT }]}>
                        <Feather name="check" size={16} color={colors.WHITE} />
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </>
    );
  }

  // 자녀 계정: 고정된 헤더만 표시
  if (userType === 'child' && selectedMember) {
    return (
      <View style={[
        styles.userSelectionCard, 
        { 
          backgroundColor: isDark ? themeColors.card : 'white',
          borderColor: colors.SUCCESS.DEFAULT,
        }
      ]}>
        <View style={styles.userCardContent}>
          <View style={styles.userMainInfo}>
            <View style={[styles.userAvatar, { backgroundColor: colors.SUCCESS.DEFAULT }]}>
              <Text style={styles.userAvatarText}>S</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: themeColors.text }]}>
                {selectedMember.name || '내 약 목록'}
              </Text>
              <Text style={[styles.userSubtitle, { color: isDark ? '#888' : '#666' }]}>
                자녀 계정 • 스케줄 편집만 가능
              </Text>
              {selectedMember.group_name && (
                <Text style={[styles.groupNameText, { color: colors.SUCCESS.DEFAULT }]}>
                  🏠 {selectedMember.group_name}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return null;
});

MemberSelector.displayName = 'MemberSelector';

const styles = StyleSheet.create({
  userSelectionCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  userCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.WHITE,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 13,
  },
  groupNameText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  expandIndicator: {
    marginLeft: 8,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandIcon: {
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  memberListContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  memberCard: {
    padding: 12,
  },
  memberCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.WHITE,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberSubtitle: {
    fontSize: 12,
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MemberSelector;

