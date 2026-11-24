export const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const temperature = [3, 4, 7, 11, 15, 18, 21, 20, 16, 12, 7, 4];
const rain = [78, 61, 55, 48, 52, 44, 38, 47, 63, 85, 92, 88];

export const weather = months.map((month, at) => ({
  month,
  at,
  temperature: temperature[at]!,
  rain: rain[at]!,
}));
