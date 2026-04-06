const fields = {
    title: document.getElementById('title'),
    artist: document.getElementById('artist'),
    album: document.getElementById('album'),
    date: document.getElementById('date'),
    trackNumber: document.getElementById('track'),
    totalTracks: document.getElementById('total-tracks'),
    discNumber: document.getElementById('disc'),
    totalDiscs: document.getElementById('total-discs'),
    composer: document.getElementById('composer'),
    albumArtist: document.getElementById('album-artist'),
    coverPreview: document.getElementById('cover-preview'),
    coverFileInput: document.getElementById('cover-file-input'),
    // lyrics: document.getElementById('lyrics-file-input')
};

function noProvided(name) {
    console.warn(`No field provided for ${name}, skipping...`);
    return '';
}

const clear = () => {
    for (const key in fields) {
        if (fields[key].tagName === 'IMG') {
            fields[key].src = 'sample_front_cover.jpg';
        } else {
            fields[key].value = '';
        }
    }
};

// --- Tag Extraction Logic ---
const handleFileSelect = (file) => {
    if (!file) return;

    // Read existing tags
    window.jsmediatags.read(file, {
        onSuccess: function (tag) {
            const tags = tag.tags;
            fields.title.value = tags.title || noProvided('title');
            fields.artist.value = tags.artist || noProvided('artist');
            fields.album.value = tags.album || noProvided('album');
            fields.trackNumber.value = tags.track || noProvided('trackNumber');
            fields.totalTracks.value = tags.totalTracks || noProvided('totalTracks');
            fields.discNumber.value = tags.disc || noProvided('discNumber');
            fields.totalDiscs.value = tags.totalDiscs || noProvided('totalDiscs');
            fields.composer.value = tags.composer || noProvided('composer');
            fields.albumArtist.value = tags.albumArtist || noProvided('albumArtist');

            // Combine TYER (YYYY) and TDAT (DDMM) into date picker format (YYYY-MM-DD)
            if (tags.year && tags.date) {
                const year = tags.year.replace(/[^0-9]/g, '');
                const dateDDMM = tags.date.replace(/[^0-9]/g, '');
                if (dateDDMM.length === 4 && year.length === 4) {
                    const month = dateDDMM.substring(2, 4);
                    const day = dateDDMM.substring(0, 2);
                    fields.date.value = `${year}-${month}-${day}`;
                }
            }

            // Process existing cover art
            if (tags.picture) {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                const url = `data:${format};base64,${window.btoa(base64String)}`;

                // Load into preview and buffer
                processImageFromUrl(url);
            }
        },
        onError: function (error) {
            console.warn("Could not read existing tags:", error.type, error.info);
        }
    });
};

// --- Image Processing (Force JPEG) ---
const processImageFromUrl = (url) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maxDim = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height *= maxDim / width;
                width = maxDim;
            } else {
                width *= maxDim / height;
                height = maxDim;
            }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onload = () => {
            fields.coverPreview.src = reader.result;
            blob.arrayBuffer().then(buffer => coverBuffer = buffer);
            };
            reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.85);
    };
    img.src = url;
};

// --- File Select Handler ---
document.getElementById('audio-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
});

// --- Save Function ---
document.getElementById('export-button').onclick = async () => {
    const mp3File = document.getElementById('audio-input').files[0];
    if (!mp3File) return alert("No MP3 file selected!");

    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const writer = new ID3Writer(reader.result);

            if (fields.title.value) writer.setFrame('TIT2', fields.title.value);
            if (fields.artist.value) writer.setFrame('TPE1', [fields.artist.value]);
            if (fields.album.value) writer.setFrame('TALB', fields.album.value);
            
            // Handle date picker: extract YYYY-MM-DD into TYER (YYYY) and TDAT (DDMM)
            if (fields.date.value) {
                const [year, month, day] = fields.date.value.split('-');
                writer.setFrame('TYER', year);
                writer.setFrame('TDAT', `${day}${month}`);
            }
            
            if (fields.trackNumber.value) writer.setFrame('TRCK', `${fields.trackNumber.value}/${fields.totalTracks.value || ''}`);
            if (fields.discNumber.value) writer.setFrame('TPOS', `${fields.discNumber.value}/${fields.totalDiscs.value || ''}`);
            if (fields.composer.value) writer.setFrame('TCOM', fields.composer.value.split(';').map(s => s.trim()));
            if (fields.albumArtist.value) writer.setFrame('TPE2', fields.albumArtist.value);

            if (coverBuffer) {
                const dataUri = fields.coverPreview.src;
                const base64 = dataUri.split(',')[1];
                const binaryString = atob(base64);
                const data = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    data[i] = binaryString.charCodeAt(i);
                }
                writer.setFrame('APIC', {
                    type: 3,
                    data: data,
                    description: 'Cover',
                    use_artwork_format: false
                });
            }

            writer.addTag();
            const taggedBlob = writer.getBlob();
            const downloadUrl = URL.createObjectURL(taggedBlob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `edited_${mp3File.name}`;
            a.click();
        } catch (err) {
            alert("RIP, something went wrong: " + err.message);
            console.error(err.stack);
        }
    };
    reader.readAsArrayBuffer(mp3File);
};

fields.coverFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processImageFromUrl(URL.createObjectURL(file));
    }
});