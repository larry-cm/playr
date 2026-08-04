export function formatColombianNumberPhone(input: string): string {
    // Elimina todo lo que no sea dígito
    let digits = input.replace(/\D/g, '');

    // Si viene con el indicativo del país (57), lo removemos para normalizar
    if (digits.startsWith('57') && digits.length > 10) {
        digits = digits.slice(2);
    }

    // Un celular colombiano válido tiene 10 dígitos y empieza por 3
    if (digits.length !== 10 || !digits.startsWith('3')) {
        return "error"
    }

    const parte1 = digits.slice(0, 3); // 300
    const parte2 = digits.slice(3, 6); // 123
    const parte3 = digits.slice(6, 10); // 4567

    return `+57 ${parte1} ${parte2} ${parte3}`;
}