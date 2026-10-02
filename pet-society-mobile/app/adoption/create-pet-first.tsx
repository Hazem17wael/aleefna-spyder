import React, { useEffect } from "react";

import { router } from "expo-router";

import { AdoptionHeader, LoadingState, ScreenShell } from "@/components/adoption/AdoptionComponents";

export default function CreatePetFirstScreen() {
  useEffect(() => {
    router.replace({
      pathname: "/add-pet",
      params: {
        adoptionMode: "true",
        returnTo: "adoption",
      },
    });
  }, []);

  return (
    <ScreenShell>
      <AdoptionHeader
        title="Add a new pet first"
        subtitle="Opening pet creation..."
      />
      <LoadingState label="Preparing pet profile form..." />
    </ScreenShell>
  );
}
