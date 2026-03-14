export function CreatePaypalButtons() 
{
    if (!window.paypal) {
        console.log('PayPal SDK not loaded yet');
        return null;
    }
    return window.paypal.Buttons({
        style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },
    });
}