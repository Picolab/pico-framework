export interface PicoQuery {
  eci: string;
  rid: string;
  name: string;
  args: {
    [key: string]: any;
  };
}
