// Calendar utilities and schedule layout mapping models
export function mapTaskToCalendar(task: any) {
  return (task.calendarSchedule || []).map((item: any) => ({
    id: item.id,
    time: item.time,
    taskTitle: item.taskTitle,
    duration: item.duration,
    deadlineDay: task.deadline ? task.deadline.split("T")[0] : null
  }));
}
