export default async function getStatsMock(): Promise<{
  noteCount: number;
  notebookCount: number;
  todoCount: number;
  reminderCount: number;
}> {
  return {
    noteCount: 361,
    notebookCount: 6,
    todoCount: 12,
    reminderCount: 5
  };
}