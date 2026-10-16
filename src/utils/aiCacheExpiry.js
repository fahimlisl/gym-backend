export const getNext1230AMIST = () => {
  const IST_OFFSET = 330 * 60 * 1000;
  const now = Date.now();

  const istDate = new Date(now + IST_OFFSET);

  let expiry =
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      0,
      30,
      0
    ) - IST_OFFSET;

  if (expiry <= now) {
    expiry += 24 * 60 * 60 * 1000;
  }

  // Redis EXAT expects Unix seconds
  return Math.floor(expiry / 1000);
};
