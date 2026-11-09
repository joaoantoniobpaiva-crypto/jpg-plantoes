# Engenharia reversa — turnopago.com.br (REA, 08/11/2026)

- Tecnologia: SPA React + Vite (gerado no Lovable: ~flock.js, __l5e), Tailwind, backend Supabase (lista de hospitais e formulário).
- Ordem da página: nav → hero (título + selos + WhatsApp | formulário completo ao lado) → faixa "Trabalhou? Receba agora." → simulador (celular desenhado + cartão) → problema (4 cartões) → 4 passos → tabela Antecipação ≠ Empréstimo → FAQ (7) → rodapé.
- Simulador (código): `liquido = valor / (1 + 0,04) ^ (dias / 30)` → 4% a.m. composto; prazos 15/30/45/60/90; padrão R$ 1.000 / 30 dias = R$ 961,54.
- Formulário: profissão (médico/enfermeiro/dentista), plantão/honorário, hospital (lista do banco), nome, CPF, PIX, CRM, UF, celular, e-mail, valor, data, anexo opcional.
- Promessas deles que a JPG NÃO copiou (avaliação de 20/10): "Isento de IOF", "mesmo negativado", "não gera dívida no CPF".

# Versão JPG (v1)
- Mesma estrutura, estética da JPG (índigo #1B3A5C, papel #F5F0E6, terracota #8C4A2F, Cormorant Garamond + Inter Tight).
- Mesma conta do simulador (4% a.m.), taxa mostrada.
- Formulário sem CPF/PIX/e-mail (LGPD): monta a mensagem e abre o WhatsApp (34) 99145-1135; nada fica salvo.
