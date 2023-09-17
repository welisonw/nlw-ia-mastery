import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = "waiting" | "converting" | "uploading" | "generating" | "sucess";

interface VideoInputFormProps{
  onVideoUploaded: (id: string) => void;
};

const statusMessages = {
  uploading: 'Carregando vídeo...',
  converting: 'Convertendo vídeo...',
  generating: 'Transcrevendo vídeo...',
  sucess: 'Sucesso!',
};

export function VideoInputForm(props: VideoInputFormProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("waiting");

  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget;

    if (!files) return;

    const selectedFile = files[0];

    setVideoFile(selectedFile);
  }

  async function convertVideoToAudio(video: File) {
    console.log("converter started");

    const ffmpeg = await getFFmpeg();

    await ffmpeg?.writeFile("input.mp4", await fetchFile(video));

    // para verificar erro
    // ffmpeg?.on('log', log => console.log(log));

    ffmpeg?.on("progress", (progress) =>
      console.log(`convert progress: ${Math.round(progress.progress * 100)}`)
    );

    await ffmpeg?.exec([
      "-i",
      "input.mp4",
      "-map",
      "0:a",
      "-b:a",
      "20k",
      "-acodec",
      "libmp3lame",
      "output.mp3",
    ]);

    const data = await ffmpeg?.readFile("output.mp3");

    const audioFileBlob = new Blob([data], { type: "audio/mpeg" });

    const audioFile = new File([audioFileBlob], "audio.mp3", {
      type: "audio/mpeg",
    });

    console.log("Convert finished!");

    return audioFile;
  }

  async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = promptInputRef.current?.value;

    if (!videoFile) return;

    setStatus("converting");

    // converter vídeo em áudio
    const audioFile = await convertVideoToAudio(videoFile);

    const data = new FormData();

    data.append("file", audioFile);

    // upload video para api
    setStatus("uploading");

    const response = await api.post("/videos", data);

    const videoId = response.data.video.id;

    // gerar a transcrição do vídeo
    setStatus("generating");

    await api.post(`videos/${videoId}/transcription`, {
      prompt,
    });

    setStatus("sucess");

    props.onVideoUploaded(videoId);
  }

  const previewURL = useMemo(() => {
    if (!videoFile) return null;

    return URL.createObjectURL(videoFile);
  }, [videoFile]);

  return (
    <form onSubmit={handleUploadVideo} className="space-y-6">
      <label
        htmlFor="video"
        className="relative flex flex-col gap-2 items-center justify-center border border-dashed rounded-md aspect-video cursor-pointer text-sm text-muted-foreground hover:bg-zinc-700/60"
      >
        {previewURL ? (
          <video
            src={previewURL}
            controls={false}
            className="pointer-events-none absolute inset-0"
          />
        ) : (
          <>
            <FileVideo className="w-4 h-4" />
            Selecione um vídeo
          </>
        )}
      </label>

      <input
        type="file"
        name="video"
        id="video"
        accept="video/mp4"
        onChange={handleFileSelected}
        className="sr-only"
      />

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
        <Textarea
          id="transcription_prompt"
          placeholder="Inclua palavras chaves mencionadas no vídeo separadas por vírgula (,)."
          ref={promptInputRef}
          disabled={status !== 'waiting'}
          className="h-20 resize-none leading-relaxed"
        />
      </div>

      <Button
        disabled={status !== "waiting"}
        type="submit"
        data-sucess={status === 'sucess'}
        className="w-full data-[sucess=true]:bg-emerald-500"
      >
        {
          status === 'waiting' ? (
            <>
              Carregar vídeo
              <Upload className="w-4 h-4 ml-2" />
            </>
          ) : (
            statusMessages[status]
          )
        }
      </Button>
    </form>
  );
}
