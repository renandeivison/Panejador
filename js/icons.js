// icons.js — biblioteca de ícones SVG inline (fornecidos pelo usuário) para navegação.
// Os SVGs usam stroke="currentColor", então herdam a cor do CSS (color) de quem os contém.

const Icons = {
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
		<path stroke-dasharray="18" d="M4.5 21.5h15">
			<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="18;0" />
		</path>
		<path stroke-dasharray="16" stroke-dashoffset="16" d="M4.5 21.5v-13.5M19.5 21.5v-13.5">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.3s" dur="0.3s" to="0" />
		</path>
		<path stroke-dasharray="28" stroke-dashoffset="28" d="M2 10l10 -8l10 8">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.6s" dur="0.4s" to="0" />
		</path>
		<path stroke-dasharray="26" stroke-dashoffset="26" d="M9.5 21.5v-9h5v9">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.9s" dur="0.6s" to="0" />
		</path>
	</g>
</svg>`,

  transactions: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
		<path stroke-dasharray="66" stroke-width="2" d="M12 3h7v18h-14v-18h7Z">
			<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="66;0" />
		</path>
		<path stroke-dasharray="14" stroke-dashoffset="14" d="M14.5 3.5v3h-5v-3">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.7s" dur="0.2s" to="0" />
		</path>
		<g stroke-width="2">
			<path stroke-dasharray="6" stroke-dashoffset="6" d="M9 10h3">
				<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.9s" dur="0.2s" to="0" />
			</path>
			<g stroke-dasharray="8" stroke-dashoffset="8">
				<path d="M9 13h5">
					<animate fill="freeze" attributeName="stroke-dashoffset" begin="1.1s" dur="0.2s" to="0" />
				</path>
				<path d="M9 16h6">
					<animate fill="freeze" attributeName="stroke-dashoffset" begin="1.3s" dur="0.2s" to="0" />
				</path>
			</g>
		</g>
	</g>
</svg>`,

  more: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none" stroke="currentColor" stroke-dasharray="16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
		<path d="M5 5h14">
			<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="16;0" />
		</path>
		<path stroke-dashoffset="16" d="M5 12h14">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.3s" dur="0.3s" to="0" />
		</path>
		<path stroke-dashoffset="16" d="M5 19h14">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.6s" dur="0.3s" to="0" />
		</path>
	</g>
</svg>`,

  installments: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<path fill="none" stroke="currentColor" stroke-dasharray="66" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4h7c0.55 0 1 0.45 1 1v14c0 0.55 -0.45 1 -1 1h-14c-0.55 0 -1 -0.45 -1 -1v-14c0 -0.55 0.45 -1 1 -1Z">
		<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="66;0" />
	</path>
	<path fill="currentColor" d="M5 5h14v0h-14Z">
		<animate fill="freeze" attributeName="d" begin="0.6s" dur="0.2s" to="M5 5h14v3h-14Z" />
	</path>
	<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
		<path stroke-dasharray="4" stroke-dashoffset="4" d="M7 4v-2M17 4v-2">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.8s" dur="0.2s" to="0" />
		</path>
		<path stroke-dasharray="12" stroke-dashoffset="12" d="M7 11h10">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.8s" dur="0.2s" to="0" />
		</path>
		<path stroke-dasharray="10" stroke-dashoffset="10" d="M7 15h7">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.8s" dur="0.2s" to="0" />
		</path>
	</g>
</svg>`,

  people: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
		<path stroke-dasharray="22" d="M12 5c1.66 0 3 1.34 3 3c0 1.66 -1.34 3 -3 3c-1.66 0 -3 -1.34 -3 -3c0 -1.66 1.34 -3 3 -3Z">
			<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.5s" values="22;0" />
		</path>
		<path stroke-dasharray="38" stroke-dashoffset="38" d="M12 14c4 0 7 2 7 3v2h-14v-2c0 -1 3 -3 7 -3Z">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.5s" dur="0.5s" to="0" />
		</path>
	</g>
</svg>`,

  settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
		<path stroke-dasharray="22" d="M12 9c1.66 0 3 1.34 3 3c0 1.66 -1.34 3 -3 3c-1.66 0 -3 -1.34 -3 -3c0 -1.66 1.34 -3 3 -3Z">
			<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="22;0" />
		</path>
		<path stroke-dasharray="44" stroke-dashoffset="44" d="M12 5.5c3.59 0 6.5 2.91 6.5 6.5c0 3.59 -2.91 6.5 -6.5 6.5c-3.59 0 -6.5 -2.91 -6.5 -6.5c0 -3.59 2.91 -6.5 6.5 -6.5Z">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.3s" dur="0.5s" to="0" />
			<set fill="freeze" attributeName="opacity" begin="0.8s" to="0" />
		</path>
		<path d="M15.24 6.37c0.41 0.23 0.8 0.51 1.14 0.83c0.22 0.2 0.42 0.41 0.61 0.63c0.47 0.57 0.86 1.22 1.12 1.94c0.09 0.26 0.17 0.54 0.24 0.82c0.1 0.45 0.15 0.93 0.15 1.41" />
		<path d="M18.5 11.99c0.01 0.47 -0.04 0.95 -0.15 1.4c-0.06 0.29 -0.15 0.57 -0.24 0.84c-0.26 0.69 -0.63 1.35 -1.12 1.94c-0.18 0.21 -0.38 0.42 -0.59 0.62c-0.34 0.31 -0.73 0.59 -1.15 0.83" />
		<path d="M15.26 17.62c-0.4 0.24 -0.84 0.44 -1.29 0.57c-0.28 0.09 -0.57 0.16 -0.85 0.21c-0.73 0.12 -1.49 0.13 -2.24 0c-0.27 -0.05 -0.55 -0.12 -0.83 -0.2c-0.44 -0.14 -0.88 -0.34 -1.3 -0.58" />
		<path d="M8.76 17.63c-0.41 -0.23 -0.8 -0.51 -1.14 -0.83c-0.22 -0.2 -0.42 -0.41 -0.61 -0.63c-0.47 -0.57 -0.86 -1.22 -1.12 -1.94c-0.09 -0.26 -0.17 -0.54 -0.24 -0.82c-0.1 -0.45 -0.15 -0.93 -0.15 -1.41" />
		<path d="M5.5 12.01c-0.01 -0.47 0.04 -0.95 0.15 -1.4c0.06 -0.29 0.15 -0.57 0.24 -0.84c0.26 -0.69 0.63 -1.35 1.12 -1.94c0.18 -0.21 0.38 -0.42 0.59 -0.62c0.34 -0.31 0.73 -0.59 1.15 -0.83" />
		<path d="M8.74 6.38c0.4 -0.24 0.84 -0.44 1.29 -0.57c0.28 -0.09 0.57 -0.16 0.85 -0.21c0.73 -0.12 1.49 -0.13 2.24 0c0.27 0.05 0.55 0.12 0.83 0.2c0.44 0.14 0.88 0.34 1.3 0.58" />
	</g>
</svg>`,

  reports: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 430 430" width="430" height="430" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="__lottie_element_1981"><rect width="430" height="430" x="0" y="0"/></clipPath><clipPath id="__lottie_element_1983"><path d="M0,0 L430,0 L430,430 L0,430z"/></clipPath></defs><g clip-path="url(#__lottie_element_1981)"><g clip-path="url(#__lottie_element_1983)" transform="matrix(1,0,0,1,0,0)" opacity="1" style="display: block;"><g transform="matrix(-1,0,0,1,115,312)" opacity="1" style="display: block;"><g opacity="1" transform="matrix(1,0,0,1,0,0)"><path stroke-linecap="butt" stroke-linejoin="round" fill-opacity="0" class="secondary" stroke="currentColor" stroke-opacity="1" stroke-width="12" d=" M-35,65 C-35,65 -35,-52.38507843017578 -35,-52.38507843017578 C-35,-52.38507843017578 35,-52.38507843017578 35,-52.38507843017578 C35,-52.38507843017578 35,65 35,65"/></g></g><g transform="matrix(-1,0,0,1,215,257.5)" opacity="1" style="display: block;"><g opacity="1" transform="matrix(1,0,0,1,0,0)"><path stroke-linecap="butt" stroke-linejoin="round" fill-opacity="0" class="secondary" stroke="currentColor" stroke-opacity="1" stroke-width="12" d=" M-35,117.5 C-35,117.5 -35,-98.26777648925781 -35,-98.26777648925781 C-35,-98.26777648925781 35,-98.26777648925781 35,-98.26777648925781 C35,-98.26777648925781 35,117.5 35,117.5"/></g></g><g transform="matrix(-1,0,0,1,315,217)" opacity="1" style="display: block;"><g opacity="1" transform="matrix(1,0,0,1,0,0)"><path stroke-linecap="butt" stroke-linejoin="round" fill-opacity="0" class="secondary" stroke="currentColor" stroke-opacity="1" stroke-width="12" d=" M-35,160 C-35,160 -35,-143.7029266357422 -35,-143.7029266357422 C-35,-143.7029266357422 35,-143.7029266357422 35,-143.7029266357422 C35,-143.7029266357422 35,160 35,160"/></g></g><g transform="matrix(1,0,0,1,215,375)" opacity="1" style="display: block;"><g opacity="1" transform="matrix(1,0,0,1,0,0)"><path stroke-linecap="round" stroke-linejoin="round" fill-opacity="0" class="primary" stroke="currentColor" stroke-opacity="1" stroke-width="12" d=" M160,0 C160,0 -160,0 -160,0"/></g></g></g></g></svg>`,

  // Provisório (estilo compatível) até você enviar o ícone oficial de "Cartões".
  cards: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
		<path stroke-dasharray="60" stroke-dashoffset="60" d="M3 6h18c0.55 0 1 0.45 1 1v10c0 0.55 -0.45 1 -1 1h-18c-0.55 0 -1 -0.45 -1 -1v-10c0 -0.55 0.45 -1 1 -1Z">
			<animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="60;0" />
		</path>
		<path stroke-dasharray="20" stroke-dashoffset="20" d="M2 10h20">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.6s" dur="0.3s" to="0" />
		</path>
		<path stroke-dasharray="8" stroke-dashoffset="8" d="M6 15h4">
			<animate fill="freeze" attributeName="stroke-dashoffset" begin="0.9s" dur="0.2s" to="0" />
		</path>
	</g>
</svg>`,
};

window.Icons = Icons;
