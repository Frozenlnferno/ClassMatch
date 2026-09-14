import { useSessionContext } from "../contexts/SessionContext.jsx";

export default function useSession() {
  return useSessionContext();
}
