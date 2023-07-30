import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";

const App = () => {
	const [locale, setLocale] = useState();

  const theme = createTheme(
    {
      scrollbarStyles: {
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '&::-webkit-scrollbar-thumb': {
          boxShadow: 'inset 0 0 6px rgba(170, 0, 126, 126)',
          backgroundColor: '#2DDD7F',
        },
      },
      palette: {
        primary: { main: "#2DDD7F" },
        third: { main: "#d17308" }
      },

      barraSuperior: {
        primary: { main: "linear-gradient(to right, #2DDD7F, #2DDD7F , #2DDD7F)" },
        secondary: { main: "#ffffff" },
      },

      barraLateral: {
        primary: { main: "#ffffff" },
      },

      icons: {
        primary: { main: "#2DDD7F" }
      },
      textColorMenu: {
        primary: { main: "#000000" },
        secondary: { main: "#2DDD7F" }
      
      },    },
    locale
  );

	useEffect(() => {
		const i18nlocale = localStorage.getItem("i18nextLng");
		const browserLocale =
			i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

		if (browserLocale === "ptBR") {
			setLocale(ptBR);
		}
	}, []);

	return (
		<ThemeProvider theme={theme}>
			<Routes />
		</ThemeProvider>
	);
};

export default App;
