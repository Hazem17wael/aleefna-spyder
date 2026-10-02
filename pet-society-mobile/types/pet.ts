import type { PetType } from "@/constants/petTypes";
import type { PetDocumentFields } from "@/utils/petDocuments";

export type { PetDocumentFields } from "@/utils/petDocuments";

export type PetImage = {
  id: string | number;
  image_path: string;
  url: string;
};

/** Minimal pet shape for shared field resolution across contexts. */
export type PetLike = PetDocumentFields & {
  id?: string | number;
  name?: string | null;
  pet_name?: string | null;
  type?: PetType | null;
  pet_type?: PetType | null;
  breed?: string | null;
  age?: number | string | null;
  gender?: string | null;
  bio?: string | null;
  image?: string | null;
  image_url?: string | null;
  images?: Array<{
    id?: string | number;
    image_path?: string | null;
    url?: string | null;
  }>;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location?: string | null;
  distance_km?: number | string | null;
};

/** Primary app pet type used by swipe, matches, chat, and my-pets. */
export type Pet = Omit<PetLike, "age" | "latitude" | "longitude" | "distance_km"> & {
  id: string | number;
  user_id: string | number;
  breed: string;
  age: number;
  gender: string;
  bio: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number;
  images?: PetImage[];
  created_at: string;
  updated_at: string;
};
