
export type StopType = 'pickup' | 'dropoff';

export interface Stop {
  id: string;
  address: string;
  stopType: StopType;
}

export interface Booking {
  id: string;
  passengerName: string;
  passengers: number;
  stops: Stop[];
}

export interface Journey {
  id: string;
  dateTime: Date;
  bookings: Booking[];
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface JourneyTemplate {
  id: string;
  name: string;
  bookings: Omit<Booking, 'id' | 'stops'> & { stops: Omit<Stop, 'id'>[] }[];
}
