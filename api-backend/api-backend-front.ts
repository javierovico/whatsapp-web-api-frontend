import axios from "axios";
import { NEXT_PUBLIC_BASE_PATH } from "@/config/environments";

const apiFront = axios.create({
  baseURL: NEXT_PUBLIC_BASE_PATH,
});

export default apiFront;

