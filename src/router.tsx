import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/layout";
import Home from "./pages/home";
import NotFound from "./pages/not-found";
import Customers from "./pages/customers";
import Guids from "./pages/guids";
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/customers",
        element: <Customers />,
      },
      {
        path: "/guids",
        element: <Guids />,
      },
      {
        path: "*",
        element: <NotFound />,
      }
    ],
  },
]);
