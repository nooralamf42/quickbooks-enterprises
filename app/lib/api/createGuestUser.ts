export const createGuestUser = async (_params: {firstName: string, lastName: string, email: string}) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { id: 'guest' };
};
