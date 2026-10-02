import React from "react";

import { Redirect, useLocalSearchParams } from "expo-router";

export default function AdoptionApplicationsDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <Redirect
      href={
        id
          ? `/my-adoption-listings/${id}/applications`
          : "/my-adoption-listings"
      }
    />
  );
}
