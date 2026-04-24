import { useCityFromUrl } from "@/hooks/useCityFromUrl";
import Layout from "@/components/Layout";

export default function CityLayout({ children }: { children: React.ReactNode }) {
  useCityFromUrl();
  return <Layout>{children}</Layout>;
}
