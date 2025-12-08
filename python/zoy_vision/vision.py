import cv2
import sys
import select
import sys
import os

IS_WINDOWS = os.name == "nt"

if IS_WINDOWS:
    import msvcrt
    
def start_camera():
    """
    Tenta abrir a primeira câmera disponível.
    """
    for i in range(3):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            print(f"Câmera aberta no índice {i}")
            return cap
    raise Exception("Não foi possível abrir a câmera")

# Função auxiliar: envia o comando serial através do stdout para o Electron
def send_serial_command(command):
    # O comando é enviado com um marcador para ser facilmente filtrado pelo Node.js
    sys.stdout.write(f"SERIAL_CMD:{command}\n")
    sys.stdout.flush() # CRUCIAL para garantir o envio imediato

def main():
    cap = start_camera()
    ret, frame1 = cap.read()
    ret, frame2 = cap.read()

    if not ret:
        print("Erro ao capturar frame inicial", file=sys.stderr)
        return

    # --- CORREÇÃO DE ESPELHAMENTO INICIAL (Aplicado a ambos os frames de referência) ---
    frame1 = cv2.flip(frame1, 1)
    frame2 = cv2.flip(frame2, 1)
    # ---------------------------------------------------------------------------------

    height, width = frame1.shape[:2]
    left_bound = width // 3
    right_bound = 2 * width // 3

    try:
        while True:
            # 1. LEITURA DE COMANDOS STDIN (PARAR_TUDO ou STATUS)

            command_line = None

            if os.name == "nt":
                # Windows ---- usar msvcrt
                import msvcrt
                if msvcrt.kbhit():
                    try:
                        command_line = sys.stdin.readline().strip()
                    except Exception:
                        command_line = None
            else:
                # Linux / macOS ---- usar select
                import select
                if select.select([sys.stdin], [], [], 0.001)[0]:
                    command_line = sys.stdin.readline().strip()

            # Processa o comando, se existir
            if command_line:
                print(f"PYTHON RECEBEU COMANDO: {command_line}")

                if command_line == "PARAR_TUDO":
                    # Comando de parada de emergência
                    send_serial_command("<PARAR:0,0>")
                    print("COMANDO EXTERNO: PARAR_TUDO EXECUTADO", file=sys.stderr)

                elif command_line == "STATUS":
                    sys.stdout.write("STATUS_OK\n")
                    sys.stdout.flush()

            # 2. PROCESSAMENTO DE VISÃO
            frame1 = frame2 # frame1 já está corrigido
            
            ret, frame2 = cap.read() # Lê o novo frame (bruto)
            if not ret:
                break

            # --- CORREÇÃO DE ESPELHAMENTO NO LOOP (Aplicado ao novo frame lido) ---
            frame2 = cv2.flip(frame2, 1) 
            # ----------------------------------------------------------------------
                
            diff = cv2.absdiff(frame1, frame2)
            gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (11,11), 0)
            _, thresh = cv2.threshold(blur, 20, 255, cv2.THRESH_BINARY)
            dilated = cv2.dilate(thresh, None, iterations=1)
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            command_sent = False

            for contour in contours:
                if cv2.contourArea(contour) < 1000:
                    continue

                x, y, w, h = cv2.boundingRect(contour)
                cx = x + w // 2

                cv2.rectangle(frame1, (x,y), (x+w, y+h), (0,255,0), 2)

                # A lógica de controle agora funcionará corretamente com a imagem desespelhada
                if cx < left_bound:
                    send_serial_command("<MOTOR_TRAS:100,100>") 
                    command_sent = True
                elif cx > right_bound:
                    send_serial_command("<MOTOR_FRENTE:100,100>")
                    command_sent = True

            # Se não detectou nenhum movimento, envia PARAR
            if not command_sent:
                send_serial_command("<PARAR:0,0>")

            # 3. REFRESH DA JANELA
            cv2.line(frame1, (left_bound,0), (left_bound,height), (255,0,0), 2)
            cv2.line(frame1, (right_bound,0), (right_bound,height), (255,0,0), 2)
            cv2.imshow("ZOY Vision Quadrantes", frame1)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

            try:
                visible = cv2.getWindowProperty("ZOY Vision Quadrantes", cv2.WND_PROP_VISIBLE)
                if visible < 1:
                    break
            except cv2.error:
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        # Nenhuma porta serial para fechar aqui
        print("Encerrado com segurança.")

if __name__ == "__main__":
    main()