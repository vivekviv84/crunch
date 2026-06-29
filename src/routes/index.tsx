import React from "react";

export interface RouteItem {
  path: string;
  element: React.ReactNode;
}

export const routes: RouteItem[] = [
  {
    path: "/",
    element: <div>Home</div>
  },
  {
    path: "/dashboard",
    element: <div>Dashboard</div>
  }
];
