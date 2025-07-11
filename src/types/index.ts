
export interface Journey {
  id: string;
  from: string;
  to: string;
  passengers: number;
  dateTime: Date;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface JourneyTemplate {
  id: string;
  name: string;
  from: string;
to: string;
  passengers: number;
}
