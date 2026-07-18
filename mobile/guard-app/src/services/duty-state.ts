import AsyncStorage from '@react-native-async-storage/async-storage';

const OPEN_ATTENDANCE_KEY = 'pssms.guard.openAttendanceId';

export async function setOpenAttendanceId(attendanceId: string): Promise<void> {
  await AsyncStorage.setItem(OPEN_ATTENDANCE_KEY, attendanceId);
}

export async function getOpenAttendanceId(): Promise<string | null> {
  return AsyncStorage.getItem(OPEN_ATTENDANCE_KEY);
}

export async function clearOpenAttendanceId(): Promise<void> {
  await AsyncStorage.removeItem(OPEN_ATTENDANCE_KEY);
}
