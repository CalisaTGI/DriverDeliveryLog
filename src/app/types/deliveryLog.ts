export type Status = "not-started" | "in-progress" | "completed";

export interface Job {
  id: number;
  jobNumber: string;
  task: string;
  paperwork: boolean;
  status: Status;
  location: string;
  startTime: string;
  stopTime: string;
  totalTime: string;
  arrivalAck: boolean;
  editing: boolean;
}

let nextIdCounter = 3;

export const makeJob = (id: number, jobNum: string): Job => ({
  id,
  jobNumber: jobNum,
  task: "",
  paperwork: false,
  status: "not-started",
  location: "",
  startTime: "",
  stopTime: "",
  totalTime: "",
  arrivalAck: false,
  editing: true,
});

export function getNextJobId(): number {
  return nextIdCounter++;
}
