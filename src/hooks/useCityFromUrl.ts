import { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCity, CITIES } from "@/context/CityContext";

const CITY_SLUGS: Record<string, string> = {
  moscow: "moscow",
  spb: "spb",
  krasnoyarsk: "krasnoyarsk",
};

export function useCityFromUrl() {
  const { citySlug } = useParams<{ citySlug?: string }>();
  const { city, setCity } = useCity();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!citySlug) return;

    const matched = CITIES.find((c) => c.id === CITY_SLUGS[citySlug]);
    if (matched) {
      if (matched.id !== city.id) {
        setCity(matched);
      }
    } else {
      // несуществующий slug — редиректим на /
      navigate("/", { replace: true });
    }
  }, [citySlug]);

  return { citySlug, location };
}

export function getCityPrefix(cityId: string): string {
  return `/${cityId}`;
}
