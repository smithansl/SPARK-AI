import { createContext, useContext } from "react";

export const WalletCtx = createContext(null);
export const useWallet = () => useContext(WalletCtx);
