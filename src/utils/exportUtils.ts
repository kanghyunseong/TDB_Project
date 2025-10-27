import { Share } from 'react-native';

interface MonthlyStats {
  month: string;
  totalDoses: number;
  completedDoses: number;
  completionRate: number;
  memberStats: Array<{
    memberId: string;
    memberName: string;
    totalDoses: number;
    completedDoses: number;
    completionRate: number;
  }>;
}

export const exportMonthlyReportAsText = async (monthlyStats: MonthlyStats[]) => {
  try {
    const currentMonth = monthlyStats[monthlyStats.length - 1];
    if (!currentMonth) {
      throw new Error('월간 데이터가 없습니다.');
    }

    const reportText = generateReportText(currentMonth, monthlyStats);
    
    await Share.share({
      message: reportText,
      title: `${currentMonth.month} 복용 리포트`
    });
    
    console.log('✅ 월간 리포트 텍스트 공유 완료');
  } catch (error) {
    console.error('📤 리포트 공유 에러:', error);
    throw error;
  }
};

const generateReportText = (currentMonth: MonthlyStats, allMonths: MonthlyStats[]): string => {
  const { month, totalDoses, completedDoses, completionRate, memberStats } = currentMonth;
  
  let report = `📊 ${month} 가족 복용 리포트\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 전체 요약
  report += `📈 이번 달 전체 현황\n`;
  report += `• 총 복용량: ${totalDoses}정\n`;
  report += `• 완료한 복용: ${completedDoses}정\n`;
  report += `• 평균 복용률: ${completionRate}%\n\n`;
  
  // 가족별 상세
  report += `👥 가족별 복용 현황\n`;
  memberStats.forEach((member, index) => {
    const emoji = member.completionRate >= 90 ? '🥇' : 
                 member.completionRate >= 80 ? '🥈' : 
                 member.completionRate >= 70 ? '🥉' : '💊';
    
    report += `${emoji} ${member.memberName}\n`;
    report += `   복용률: ${member.completionRate}% (${member.completedDoses}/${member.totalDoses}정)\n`;
    if (index < memberStats.length - 1) report += `\n`;
  });
  
  // 월별 추이 (최근 3개월)
  if (allMonths.length >= 3) {
    report += `\n\n📊 최근 3개월 추이\n`;
    const recentMonths = allMonths.slice(-3);
    recentMonths.forEach((monthData, index) => {
      const trend = index > 0 ? 
        (monthData.completionRate > recentMonths[index - 1].completionRate ? '📈' : '📉') : '📊';
      
      report += `${trend} ${monthData.month.split(' ')[1]}: ${monthData.completionRate}%\n`;
    });
  }
  
  // 마무리
  report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `💊 TDB 앱에서 생성된 리포트입니다.\n`;
  report += `📅 생성일: ${new Date().toLocaleDateString('ko-KR')}\n`;
  
  return report;
};

export const exportDailyScheduleAsText = async (
  memberName: string, 
  medicines: Array<{
    name: string;
    morning: number;
    afternoon: number;
    evening: number;
  }>
) => {
  try {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    
    let schedule = `📅 ${today}\n`;
    schedule += `👤 ${memberName}님의 복용 스케줄\n`;
    schedule += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    const timeSlots = [
      { name: '🌅 아침', key: 'morning' as const },
      { name: '☀️ 점심', key: 'afternoon' as const },
      { name: '🌙 저녁', key: 'evening' as const }
    ];
    
    timeSlots.forEach(timeSlot => {
      schedule += `${timeSlot.name} 복용\n`;
      
      const medicinesForTime = medicines.filter(med => med[timeSlot.key] > 0);
      
      if (medicinesForTime.length === 0) {
        schedule += `   복용할 약이 없습니다.\n\n`;
      } else {
        medicinesForTime.forEach(med => {
          schedule += `   • ${med.name}: ${med[timeSlot.key]}정\n`;
        });
        schedule += `\n`;
      }
    });
    
    schedule += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    schedule += `💊 TDB 앱에서 생성된 스케줄입니다.\n`;
    
    await Share.share({
      message: schedule,
      title: `${memberName}님의 복용 스케줄`
    });
    
    console.log('✅ 일일 스케줄 텍스트 공유 완료');
  } catch (error) {
    console.error('📤 스케줄 공유 에러:', error);
    throw error;
  }
}; 